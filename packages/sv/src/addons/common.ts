import { log } from '@clack/prompts';
import { color, type SvelteAst, type TransformFn, transforms } from '@sveltejs/sv-utils';
import process from 'node:process';

// This is in common because the eslint addon installs this version,
// and the prettier addon uses this to check if the installed major version of
// eslint is supported by `addEslintConfigPrettier(...)`.
export const ESLINT_VERSION = /* update-deps: eslint */ '^10.4.1';

export const addEslintConfigPrettier = transforms.script(({ ast, js }) => {
	// if a default import for `eslint-plugin-svelte` already exists, then we'll use their specifier's name instead
	const importNodes = ast.body.filter((n) => n.type === 'ImportDeclaration');
	const sveltePluginImport = importNodes.find(
		(n) =>
			n.type === 'ImportDeclaration' &&
			n.source.value === 'eslint-plugin-svelte' &&
			n.specifiers?.some((n) => n.type === 'ImportDefaultSpecifier')
	);

	let svelteImportName: string;
	for (const specifier of sveltePluginImport?.specifiers ?? []) {
		if (specifier.type === 'ImportDefaultSpecifier' && specifier.local?.name) {
			svelteImportName = specifier.local.name;
		}
	}
	svelteImportName ??= 'svelte';

	js.imports.addDefault(ast, { from: 'eslint-plugin-svelte', as: svelteImportName });
	js.imports.addDefault(ast, { from: 'eslint-config-prettier', as: 'prettier' });

	const fallbackConfig = js.common.parseExpression('[]');
	const defaultExport = js.exports.createDefault(ast, { fallback: fallbackConfig });
	const eslintConfig = defaultExport.value;

	type Elements =
		| Extract<typeof eslintConfig, { type: 'CallExpression' }>['arguments']
		| Extract<typeof eslintConfig, { type: 'ArrayExpression' }>['elements'];

	let elements: Elements = [];

	if (eslintConfig.type === 'ArrayExpression') {
		// export default [...]
		elements = eslintConfig.elements;
	} else if (eslintConfig.type === 'CallExpression') {
		if (
			eslintConfig.arguments.length === 1 &&
			eslintConfig.arguments[0].type === 'ArrayExpression'
		) {
			// export default defineConfig([...])
			elements = eslintConfig.arguments[0].elements;
		} else {
			// export default defineConfig({...})
			elements = eslintConfig.arguments;
		}
	} else {
		// fallback: Not an array or a function call
		return false;
	}

	const prettier = js.common.parseExpression('prettier');
	const sveltePrettierConfig = js.common.parseExpression(`${svelteImportName}.configs.prettier`);

	const nodesToInsert = [];
	if (!js.common.contains(eslintConfig, prettier)) nodesToInsert.push(prettier);
	if (!js.common.contains(eslintConfig, sveltePrettierConfig))
		nodesToInsert.push(sveltePrettierConfig);

	const isSvelteConfig = (maybeSpread: Elements[number]) => {
		const el =
			maybeSpread?.type === 'SpreadElement'
				? // ...svelte.configs.*
					maybeSpread?.argument
				: // svelte.configs.*
					maybeSpread;
		return (
			el?.type === 'MemberExpression' &&
			el.object.type === 'MemberExpression' &&
			// Check for [svelte].configs.*
			el.object.object.type === 'Identifier' &&
			el.object.object.name === svelteImportName &&
			// Check for svelte.[configs].*
			el.object.property.type === 'Identifier' &&
			el.object.property.name === 'configs'
		);
	};
	const idx = elements.findIndex(isSvelteConfig);
	if (idx !== -1) {
		elements.splice(idx + 1, 0, ...nodesToInsert);
	} else {
		// append to the end as a fallback
		elements.push(...nodesToInsert);
	}
});

/**
 * Path of the prettier config file we generate. We always emit a `.js` file (with a JSDoc `@type`)
 * rather than `.ts`, since the VSCode prettier extension can't load a `.ts` config without a recent
 * enough Node in its extension host (see prettier/prettier-vscode#3989).
 */
export function prettierConfigPath(): string {
	return 'prettier.config.js';
}

/**
 * Creates a `prettier.config.js` file with our defaults. Bails (leaving the file untouched)
 * if a config is already defined.
 */
export const createPrettierConfig = (opts: {
	tailwind: boolean;
	stylesheet?: string;
}): TransformFn =>
	transforms.script(({ ast, comments, js }) => {
		if (ast.body.some((node) => node.type === 'ExportDefaultDeclaration')) {
			log.warn(`A ${color.warning('prettier')} config already exists. Skipping initialization.`);
			return false;
		}

		const plugins = ['prettier-plugin-svelte'];
		if (opts.tailwind) plugins.push('prettier-plugin-tailwindcss');

		const properties = [
			'useTabs: true',
			'singleQuote: true',
			`trailingComma: 'none'`,
			'printWidth: 100',
			`plugins: [${plugins.map((p) => `'${p}'`).join(', ')}]`,
			`overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }]`
		];
		if (opts.tailwind && opts.stylesheet) {
			properties.push(`tailwindStylesheet: '${opts.stylesheet}'`);
		}

		// parsed from source (rather than built node-by-node) so the JSDoc `@type` keeps its own line
		// above `const config`; esrap inlines programmatically-added comments but honors parsed ones.
		// indentation here is irrelevant - esrap reprints the parsed AST from scratch.
		js.common.appendFromString(ast, {
			comments,
			code: `
				/** @type {import("prettier").Config} */
				const config = { ${properties.join(', ')} };
				export default config;
			`
		});
	});

/**
 * Augments an existing `prettier.config.js` config object with the tailwindcss plugin and
 * stylesheet. Used when prettier was added before tailwindcss.
 */
export const addPrettierTailwind = (opts: { stylesheet: string }): TransformFn =>
	transforms.script(({ ast, js }) => {
		if (!ast.body.some((node) => node.type === 'ExportDefaultDeclaration')) return false;

		const { value } = js.exports.createDefault(ast, { fallback: js.object.create({}) });
		if (value.type !== 'ObjectExpression') return false;

		const plugins = js.object.property(value, { name: 'plugins', fallback: js.array.create() });
		if (plugins.type === 'ArrayExpression') js.array.append(plugins, 'prettier-plugin-tailwindcss');

		const hasStylesheet = value.properties.some(
			(p) =>
				p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'tailwindStylesheet'
		);
		if (!hasStylesheet) {
			js.object.property(value, {
				name: 'tailwindStylesheet',
				fallback: js.common.createLiteral(opts.stylesheet)
			});
		}
	});

type CreateDemoPage = (
	name: string,
	language: 'ts' | 'js'
) => { transform: TransformFn; listingPath: string; addonPath: string };
export const createDemoPage: CreateDemoPage = (name, language) => ({
	listingPath: '/addon',
	addonPath: `/addon/${name}`,
	transform: transforms.svelteScript({ language }, ({ ast, js, svelte }) => {
		for (const node of ast.fragment.nodes) {
			if (node.type === 'RegularElement') {
				const hrefAttribute = node.attributes.find(
					(x) => x.type === 'Attribute' && x.name === 'href'
				) as SvelteAst.Attribute;
				if (!hrefAttribute || !hrefAttribute.value) continue;

				if (!Array.isArray(hrefAttribute.value)) continue;

				const hasDemo = hrefAttribute.value.some(
					// we use includes as it could be "/addon/${name}" or "resolve("addon/${name}")" or "resolve('addon/${name}')"
					(x) => x.type === 'Text' && x.data.includes(`/addon/${name}`)
				);
				if (hasDemo) {
					return false;
				}
			}
		}

		js.imports.addNamed(ast.instance.content, { imports: ['resolve'], from: '$app/paths' });

		svelte.addFragment(ast, `<a href={resolve('/addon/${name}')}>${name}</a>`, { mode: 'prepend' });
	})
});

/**
 * Returns the corresponding `@types/node` version for the version of Node.js running in the current process.
 *
 * If the installed version of Node.js is from a `Current` release, then the major is decremented to
 * the nearest `LTS` release version.
 */
export function getNodeTypesVersion(): string {
	const nodeVersion = process.versions.node;
	const isDenoOrBun = Boolean(process.versions.deno ?? process.versions.bun);
	const [major] = nodeVersion.split('.');

	const majorNum = Number(major);
	const isEvenMajor = majorNum % 2 === 0;
	const isLTS = !!process.release.lts || (isDenoOrBun && isEvenMajor);
	if (isLTS) {
		return `^${major}`;
	}

	// It's possible for an even major number to _temporarily_ not
	// be an `LTS` release (meaning `process.release.lts` is `undefined`) during it's `Current` stage.
	// In those cases, we'll decrement the major by 2.
	const previousLTSMajor = isEvenMajor ? majorNum - 2 : majorNum - 1;
	return `^${previousLTSMajor}`;
}
