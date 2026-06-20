import { log } from '@clack/prompts';
import {
	type AstTypes,
	color,
	type SvelteAst,
	type TransformFn,
	transforms
} from '@sveltejs/sv-utils';
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

/** Path of the prettier config file we generate, based on the project language. */
export function prettierConfigPath(language: 'ts' | 'js'): string {
	return language === 'ts' ? 'prettier.config.ts' : 'prettier.config.js';
}

/**
 * Creates a `prettier.config.{js,ts}` file with our defaults. Bails (leaving the file untouched)
 * if a config is already defined.
 */
export const createPrettierConfig = (opts: {
	typescript: boolean;
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

		const data: Record<string, any> = {
			useTabs: true,
			singleQuote: true,
			trailingComma: 'none',
			printWidth: 100,
			plugins,
			overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }]
		};
		if (opts.tailwind && opts.stylesheet) data.tailwindStylesheet = opts.stylesheet;

		const configObject = js.object.create(data);
		const declaration = js.variables.declaration(ast, {
			kind: 'const',
			name: 'config',
			value: configObject
		});
		const declarator = declaration.declarations[0] as AstTypes.VariableDeclarator;

		if (opts.typescript) {
			js.variables.typeAnnotateDeclarator(declarator, { typeName: 'Config' });
			js.imports.addNamed(ast, { from: 'prettier', imports: ['Config'], isType: true });
		} else {
			js.common.addJsDocTypeComment(declaration, comments, { type: 'import("prettier").Config' });
		}

		ast.body.push(declaration);
		ast.body.push({
			type: 'ExportDefaultDeclaration',
			declaration: js.variables.createIdentifier('config')
		} as AstTypes.ExportDefaultDeclaration);
	});

/**
 * Augments an existing `prettier.config.{js,ts}` config object with the tailwindcss plugin and
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

type AddToDemoPage = (path: string, language: 'ts' | 'js') => TransformFn;
export const addToDemoPage: AddToDemoPage = (path, language) =>
	transforms.svelteScript({ language }, ({ ast, js, svelte }) => {
		for (const node of ast.fragment.nodes) {
			if (node.type === 'RegularElement') {
				const hrefAttribute = node.attributes.find(
					(x) => x.type === 'Attribute' && x.name === 'href'
				) as SvelteAst.Attribute;
				if (!hrefAttribute || !hrefAttribute.value) continue;

				if (!Array.isArray(hrefAttribute.value)) continue;

				const hasDemo = hrefAttribute.value.some(
					// we use includes as it could be "/demo/${path}" or "resolve("demo/${path}")" or "resolve('demo/${path}')"
					(x) => x.type === 'Text' && x.data.includes(`/demo/${path}`)
				);
				if (hasDemo) {
					return false;
				}
			}
		}

		js.imports.addNamed(ast.instance.content, { imports: ['resolve'], from: '$app/paths' });

		svelte.addFragment(ast, `<a href={resolve('/demo/${path}')}>${path}</a>`, { mode: 'prepend' });
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
