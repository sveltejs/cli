import fs from 'node:fs';
import path from 'node:path';
import { type AstTypes, defineDemoPage, js, transforms } from '@sveltejs/sv-utils';
import * as v from 'valibot';
import { defineAddon, type AddonDefinition, type SvApi } from './config.ts';
import type { Workspace } from './workspace.ts';

export const LIGHT_ADDON_FILE = 'sv.json';

const REGEX_PASCAL_PARTS = /[^a-zA-Z0-9]+(.)?/g;
const REGEX_FIRST_CHAR = /^./;

const named = { from: v.string(), import: v.string(), call: v.string() };
const byDefault = { from: v.string(), default: v.string(), call: v.string() };
const position = { position: v.optional(v.picklist(['start', 'end'])) };

const Import = v.union([v.strictObject(named), v.strictObject(byDefault)]);
const VitePlugin = v.union([
	v.strictObject({ ...named, ...position }),
	v.strictObject({ ...byDefault, ...position })
]);

const Deps = v.record(v.string(), v.string());

const LightAddonSchema = v.strictObject({
	$schema: v.optional(v.string()),
	id: v.pipe(v.string(), v.minLength(1)),
	description: v.optional(v.string()),
	homepage: v.optional(v.string()),
	/** Required when nothing else implies it (`hooks` and `demo` do). */
	kit: v.optional(v.boolean()),
	dependencies: v.optional(Deps),
	devDependencies: v.optional(Deps),
	vite: v.optional(v.array(VitePlugin)),
	hooks: v.optional(v.strictObject({ server: v.optional(v.array(Import)) })),
	files: v.optional(v.array(v.strictObject({ from: v.string(), to: v.string() }))),
	/** Folder copied to `<routes>/demo/<id>`, linked from the demo page. */
	demo: v.optional(v.string()),
	nextSteps: v.optional(v.array(v.string()))
});

export type LightAddon = v.InferOutput<typeof LightAddonSchema>;
type ImportEntry = v.InferOutput<typeof Import>;

/** `file:` points at a `sv.json` or a folder holding one. */
export function findLightAddonFile(target: string): string | undefined {
	if (target.endsWith('.json')) return fs.existsSync(target) ? target : undefined;
	const file = path.join(target, LIGHT_ADDON_FILE);
	return fs.existsSync(file) ? file : undefined;
}

export function loadLightAddon(file: string): AddonDefinition {
	let raw: unknown;
	try {
		raw = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (e) {
		throw new Error(`Invalid light add-on '${file}': ${e instanceof Error ? e.message : e}`, {
			cause: e
		});
	}
	const result = v.safeParse(LightAddonSchema, raw);
	if (!result.success) {
		const issues = result.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`);
		throw new Error(`Invalid light add-on '${file}':\n- ${issues.join('\n- ')}`);
	}
	return lightToAddon(result.output, path.dirname(file));
}

export function lightToAddon(light: LightAddon, baseDir: string): AddonDefinition {
	const needsKit = Boolean(light.kit || light.hooks?.server?.length || light.demo);

	return defineAddon({
		id: light.id,
		shortDescription: light.description,
		homepage: light.homepage,
		options: {},
		setup: ({ isKit, unsupported }) => {
			if (needsKit && !isKit) unsupported('Requires SvelteKit');
		},
		run: (workspace) => {
			const { sv, cancel, dependencyVersion } = workspace;

			// never touch a version the project already declares
			for (const [pkg, version] of Object.entries(light.dependencies ?? {})) {
				if (!dependencyVersion(pkg)) sv.dependency(pkg, version);
			}
			for (const [pkg, version] of Object.entries(light.devDependencies ?? {})) {
				if (!dependencyVersion(pkg)) sv.devDependency(pkg, version);
			}

			if (light.vite?.length) addVitePlugins(sv, workspace, light.vite);
			if (light.hooks?.server?.length) addServerHooks(sv, workspace, light.id, light.hooks.server);

			try {
				for (const entry of light.files ?? []) {
					copyFolder(
						sv,
						resolveSource(baseDir, entry.from, workspace.language),
						resolveTo(entry.to, workspace)
					);
				}
				if (light.demo) {
					const demo = defineDemoPage(light.id, workspace.language, workspace.directory.kitRoutes);
					copyFolder(sv, resolveSource(baseDir, light.demo, workspace.language), demo.addonPath);
					sv.file(...demo.links);
					sv.file(...demo.layout);
				}
			} catch (e) {
				return cancel(e instanceof Error ? e.message : String(e));
			}
		},
		nextSteps: () => light.nextSteps ?? []
	});
}

function quoted(content: string, from: string) {
	return content.includes(`'${from}'`) || content.includes(`"${from}"`);
}

function addImport(ast: AstTypes.Program, entry: ImportEntry) {
	if ('default' in entry) js.imports.addDefault(ast, { as: entry.default, from: entry.from });
	else js.imports.addNamed(ast, { imports: [entry.import], from: entry.from });
}

function addVitePlugins(sv: SvApi, workspace: Workspace, plugins: LightAddon['vite'] & {}) {
	sv.file(
		workspace.file.viteConfig,
		transforms.script(({ ast, content }) => {
			const todo = plugins.filter((p) => !quoted(content, p.from));
			if (todo.length === 0) return false;

			// prepending reverses order, so walk `start` entries backwards to keep the authored order
			const start = todo.filter((p) => p.position === 'start').reverse();
			const end = todo.filter((p) => p.position !== 'start');
			for (const p of [...start, ...end]) {
				addImport(ast, p);
				js.vite.addPlugin(ast, {
					code: p.call,
					mode: p.position === 'start' ? 'prepend' : 'append'
				});
			}
		})
	);
}

function addServerHooks(sv: SvApi, workspace: Workspace, id: string, hooks: ImportEntry[]) {
	const kitVersion = workspace.dependencyVersion('@sveltejs/kit');
	sv.file(
		`src/hooks.server.${workspace.language}`,
		transforms.script(({ ast, comments, content }) => {
			const todo = hooks.filter((h) => !quoted(content, h.from));
			if (todo.length === 0) return false;

			todo.forEach((h, i) => {
				addImport(ast, h);
				js.kit.addHooksHandle(ast, {
					language: workspace.language,
					newHandleName: handleName(id, i),
					handleContent: h.call,
					comments,
					kitVersion
				});
			});
		})
	);
}

function handleName(id: string, index: number) {
	const pascal = id
		.replace(REGEX_PASCAL_PARTS, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
		.replace(REGEX_FIRST_CHAR, (c) => c.toUpperCase());
	return `handle${pascal}${index === 0 ? '' : index + 1}`;
}

/** A `ts`/`js` subfolder pair picks the project's language; a lone one restricts it. */
function resolveSource(baseDir: string, from: string, language: 'ts' | 'js') {
	const dir = path.resolve(baseDir, from);
	if (!fs.existsSync(dir)) throw new Error(`Light add-on folder not found: ${from}`);
	const own = path.join(dir, language);
	const other = path.join(dir, language === 'ts' ? 'js' : 'ts');
	if (fs.existsSync(own)) return own;
	if (fs.existsSync(other)) {
		throw new Error(
			`'${from}' only ships ${language === 'ts' ? 'JavaScript' : 'TypeScript'} files`
		);
	}
	return dir;
}

function resolveTo(to: string, workspace: Workspace) {
	if (to === '$lib' || to.startsWith('$lib/')) return workspace.directory.lib + to.slice(4);
	if (to === '$routes' || to.startsWith('$routes/'))
		return workspace.directory.kitRoutes + to.slice(7);
	return to;
}

function copyFolder(sv: SvApi, src: string, to: string) {
	for (const entry of fs.readdirSync(src, { withFileTypes: true, recursive: true })) {
		if (!entry.isFile()) continue;
		const abs = path.join(entry.parentPath, entry.name);
		const rel = path.relative(src, abs).split(path.sep).join('/');
		const body = fs.readFileSync(abs, 'utf8');
		// existing files belong to the user
		sv.file(`${to}/${rel}`, (content) => (content ? false : body));
	}
}
