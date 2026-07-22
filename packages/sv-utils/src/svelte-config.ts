import { loadFile } from './files.ts';
import type { AstTypes, Comments } from './tooling/index.ts';
import * as jsNs from './tooling/js/index.ts';
import {
	findSveltekitCall,
	getConfigRoot,
	getKitObject,
	hasDefaultExport,
	type SvelteConfigKind
} from './tooling/js/svelte-config.ts';
import { parseScript } from './tooling/parsers.ts';
import { transforms } from './tooling/transforms.ts';

export type { SvelteConfigKind } from './tooling/js/svelte-config.ts';

/** The four config file paths the helper understands. */
export type SvelteConfigPath = `${'svelte.config' | 'vite.config'}.${'js' | 'ts'}`;

export type SvelteConfigLocation = {
	/** path relative to the workspace root, e.g. `vite.config.ts` or `svelte.config.js` */
	path: SvelteConfigPath;
	kind: SvelteConfigKind;
};

/** The located config plus its resolved object expressions (returned by `read`). */
export type SvelteConfigObjects = {
	location: SvelteConfigLocation;
	/** svelte-level config object (`preprocess`, `extensions`, `compilerOptions`, `vitePlugin`). */
	config: AstTypes.ObjectExpression;
	/** kit-level config object (`adapter`, `alias`, `files`, `typescript`, ...). */
	kit: AstTypes.ObjectExpression;
};

/** Reads a workspace file. Returns `null` when the file doesn't exist. (the injected environment) */
export type ConfigFileReader = (path: string) => string | null;

/**
 * A `cwd` (read through `loadFile`) or an explicit reader (e.g. an in-memory map for tests).
 * `loadFile` returns `''` for a missing file, which parses to an empty program and matches no
 * candidate - i.e. the same outcome as a `null` from a custom reader.
 */
type ConfigSource = string | ConfigFileReader;
const toReader = (source: ConfigSource): ConfigFileReader =>
	typeof source === 'string' ? (path) => loadFile(source, path) : source;

type ObjectMap = Parameters<typeof jsNs.object.overrideProperties>[1];

/**
 * The top-level options that live on the svelte config object itself. Everything else (`adapter`,
 * `alias`, `files`, `typescript`, ...) is a kit-level option, which sits under `kit` in a
 * `svelte.config` but flattened onto the `sveltekit()` argument in a `vite.config`. Callers address
 * options by name and `edit` routes them to the right place, so they never have to know about `kit`.
 */
const SVELTE_LEVEL_OPTIONS = new Set([
	'compilerOptions',
	'preprocess',
	'extensions',
	'vitePlugin',
	'onwarn'
]);

// `svelte.config` is checked first so legacy projects (where the real config lives there) win
// even if a `vite.config` with a bare `sveltekit()` call is also present.
const SVELTE_CANDIDATES = ['svelte.config.js', 'svelte.config.ts'] as const;
const VITE_CANDIDATES = ['vite.config.ts', 'vite.config.js'] as const;

function tryParse(read: ConfigFileReader, path: string): AstTypes.Program | undefined {
	const source = read(path);
	if (source === null) return undefined;
	try {
		return parseScript(source).ast;
	} catch {
		return undefined;
	}
}

/** Detects the config location AND keeps the parsed AST, so callers don't have to parse twice. */
function locate(
	read: ConfigFileReader
): { location: SvelteConfigLocation; ast: AstTypes.Program } | null {
	for (const path of SVELTE_CANDIDATES) {
		const ast = tryParse(read, path);
		if (ast && hasDefaultExport(ast)) return { location: { path, kind: 'svelte' }, ast };
	}
	for (const path of VITE_CANDIDATES) {
		const ast = tryParse(read, path);
		if (ast && findSveltekitCall(ast)) return { location: { path, kind: 'vite' }, ast };
	}
	return null;
}

/**
 * Detects where the svelte/kit config lives, reading candidate files through the injected `read`.
 *
 * Returns `null` when no config could be found (e.g. not a SvelteKit project, or the config
 * file is unparsable). Detection is static - the config is never executed.
 */
function find(source: ConfigSource): SvelteConfigLocation | null {
	return locate(toReader(source))?.location ?? null;
}

/**
 * Locates the config and returns its `{ location, config, kit }` object expressions in a single
 * parse. Returns `null` when no config is found. Throws if the located config has an unexpected
 * shape (e.g. a non-object default export).
 */
function read(source: ConfigSource): SvelteConfigObjects | null {
	const found = locate(toReader(source));
	if (!found) return null;
	const config = getConfigRoot(found.ast, found.location.kind);
	const kit = getKitObject(config, found.location.kind);
	return { location: found.location, config, kit };
}

export type SvelteConfEdit = (file: {
	ast: AstTypes.Program;
	comments: Comments;
	js: typeof jsNs;
	location: SvelteConfigLocation;
	/**
	 * Get-or-create a top-level config option's value, placed in the correct location for its name
	 * (kit-level options end up under `kit` in a `svelte.config`, flattened in a `vite.config`).
	 */
	property: <T extends AstTypes.Expression | AstTypes.Identifier>(
		name: string,
		opts: { fallback: T }
	) => T;
	/**
	 * Set/override top-level config options, each routed to the correct location by its name.
	 * Pass `dropLeadingComments` with option names whose now-stale leading comments should be removed
	 * (e.g. the adapter-auto note when switching adapters).
	 */
	override: (props: ObjectMap, opts?: { dropLeadingComments?: string[] }) => void;
}) => void | false;

/** Minimal shape of the `sv` api needed to write a file. */
export type SvFileApi = {
	file: (path: string, edit: (content: string) => string | false) => void;
};

/** Removes comments sitting between `name`'s property and its previous sibling (its leading note). */
function dropLeadingComments(
	container: AstTypes.ObjectExpression,
	name: string,
	comments: Comments
): void {
	const prop = container.properties.find(
		(p): p is AstTypes.Property =>
			p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name
	);
	const start = prop?.loc?.start.line;
	if (start === undefined) return;

	let lowerBound = container.loc?.start.line ?? 0;
	for (const p of container.properties) {
		if (p === prop) continue;
		const end = p.loc?.end.line;
		if (end !== undefined && end < start && end > lowerBound) lowerBound = end;
	}
	comments.remove((c) => !!c.loc && c.loc.start.line > lowerBound && c.loc.end.line < start);
}

/** The environment-free core of `edit` - parse `content`, apply `editFn`, return the new source. */
function editContent(
	content: string,
	location: SvelteConfigLocation,
	editFn: SvelteConfEdit
): string {
	return transforms.script(({ ast, comments, js }) => {
		const config = getConfigRoot(ast, location.kind);
		// the `kit` object is only materialized when a kit-level option is actually edited, so a
		// svelte-only edit (e.g. mdsvex) doesn't leave a spurious empty `kit: {}` behind
		let kit: AstTypes.ObjectExpression | undefined;
		const kitObject = () => (kit ??= getKitObject(config, location.kind));
		const containerFor = (name: string) => (SVELTE_LEVEL_OPTIONS.has(name) ? config : kitObject());

		const property: Parameters<SvelteConfEdit>[0]['property'] = (name, opts) =>
			js.object.property(containerFor(name), { name, ...opts });

		const override: Parameters<SvelteConfEdit>[0]['override'] = (props, opts) => {
			const svelteProps: ObjectMap = {};
			const kitProps: ObjectMap = {};
			for (const [key, value] of Object.entries(props)) {
				(SVELTE_LEVEL_OPTIONS.has(key) ? svelteProps : kitProps)[key] = value;
			}
			if (Object.keys(svelteProps).length) js.object.overrideProperties(config, svelteProps);
			if (Object.keys(kitProps).length) js.object.overrideProperties(kitObject(), kitProps);
			for (const name of opts?.dropLeadingComments ?? []) {
				dropLeadingComments(containerFor(name), name, comments);
			}
		};

		return editFn({ ast, comments, js, location, property, override });
	})(content);
}

/**
 * Edits the svelte/kit config wherever it lives, abstracting over the two possible locations
 * (a `svelte.config.{js,ts}` default export, or the object passed to `sveltekit()` in a
 * `vite.config.{js,ts}`). When the project has neither, a new `svelte.config.js` is created.
 *
 * Options are addressed by name and routed to the right place internally, so add-ons never have to
 * know whether something lives under `kit`:
 *
 * @example
 * ```ts
 * svelteConfig.edit({ sv, cwd }, ({ override, js }) => {
 *   js.imports.addDefault(ast, { from: '@sveltejs/adapter-node', as: 'adapter' });
 *   override({ adapter: js.functions.createCall({ name: 'adapter', args: [], useIdentifiers: true }) });
 * });
 * ```
 */
function edit({ sv, cwd }: { sv: SvFileApi; cwd: string }, editFn: SvelteConfEdit): void {
	const location = find(cwd) ?? {
		path: 'vite.config.js',
		kind: 'vite'
	};

	sv.file(location.path, (content) => editContent(content, location, editFn));
}

/**
 * Helpers for the svelte/kit config, which can live either in a `svelte.config.{js,ts}` default
 * export or in the object passed to `sveltekit()` in a `vite.config.{js,ts}`.
 */
export const svelteConfig: {
	/** Edit the config wherever it lives (creating `svelte.config.js` if there is none). */
	edit: (target: { sv: SvFileApi; cwd: string }, editFn: SvelteConfEdit) => void;
	/** Locate the config file, returning `{ path, kind }` or `null`. Detection is static (no execution). */
	find: (source: ConfigSource) => SvelteConfigLocation | null;
	/** Locate + parse the config in one pass, returning `{ location, config, kit }` or `null`. */
	read: (source: ConfigSource) => SvelteConfigObjects | null;
} = {
	edit,
	find,
	read
};

/** @internal exported for tests - the environment-free core of `svelteConfig.edit`. */
export { editContent as _editConfigContent };
