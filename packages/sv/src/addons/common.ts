import { type SvelteAst, js, parse, svelte } from '@sveltejs/sv-utils';
import process from 'node:process';

export function addEslintConfigPrettier(content: string): string {
	const { ast, generateCode } = parse.script(content);

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

	const isDefineConfig = eslintConfig.type === 'CallExpression'; // export default defineConfig()
	const isArrayExport = eslintConfig.type === 'ArrayExpression'; // export default []

	if (!isArrayExport && !isDefineConfig) return content;

	const prettier = js.common.parseExpression('prettier');
	const sveltePrettierConfig = js.common.parseExpression(`${svelteImportName}.configs.prettier`);

	const nodesToInsert = [];
	if (!js.common.contains(eslintConfig, prettier)) nodesToInsert.push(prettier);
	if (!js.common.contains(eslintConfig, sveltePrettierConfig))
		nodesToInsert.push(sveltePrettierConfig);

	// i dont know the type
	const isSvelteConfig = (el: any) => {
		const maybeSpread = el?.type === 'SpreadElement' ? el?.argument : el;
		return (
			maybeSpread?.object.type === 'MemberExpression' &&
			maybeSpread.object.property.type === 'Identifier' &&
			maybeSpread.object.property.name === 'configs' &&
			maybeSpread.object.object.type === 'Identifier' &&
			maybeSpread.object.object.name === svelteImportName
		);
	};

	if (isDefineConfig) {
		const container =
			eslintConfig.arguments.length === 1 && eslintConfig.arguments[0].type === 'ArrayExpression'
				? // javascript - defineConfig([...])
					eslintConfig.arguments[0].elements
				: // typescript - defineConfig(...)
					eslintConfig.arguments;

		const idx = container.findIndex(isSvelteConfig);
		if (idx !== -1) {
			container.splice(idx + 1, 0, ...nodesToInsert);
		} else {
			container.push(...nodesToInsert);
		}
	}

	if (isArrayExport) {
		const idx = eslintConfig.elements.findIndex(isSvelteConfig);
		if (idx !== -1) {
			eslintConfig.elements.splice(idx + 1, 0, ...nodesToInsert);
		} else {
			eslintConfig.elements.push(...nodesToInsert);
		}
	}

	return generateCode();
}

export function addToDemoPage(
	existingContent: string,
	path: string,
	language: 'ts' | 'js'
): string {
	const { ast, generateCode } = parse.svelte(existingContent);

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
				return existingContent;
			}
		}
	}

	svelte.ensureScript(ast, { language });
	js.imports.addNamed(ast.instance.content, { imports: ['resolve'], from: '$app/paths' });

	svelte.addFragment(ast, `<a href={resolve('/demo/${path}')}>${path}</a>`, { mode: 'prepend' });
	ast.fragment.nodes.unshift();

	return generateCode();
}

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
