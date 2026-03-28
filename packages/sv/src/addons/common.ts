import { type SvelteAst, svelte, transforms } from '@sveltejs/sv-utils';
import process from 'node:process';

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
			svelteImportName = specifier.local.name as string;
		}
	}

	svelteImportName ??= 'svelte';
	js.imports.addDefault(ast, { from: 'eslint-plugin-svelte', as: svelteImportName });
	js.imports.addDefault(ast, { from: 'eslint-config-prettier', as: 'prettier' });

	const fallbackConfig = js.common.parseExpression('[]');
	const defaultExport = js.exports.createDefault(ast, { fallback: fallbackConfig });
	const eslintConfig = defaultExport.value;
	if (eslintConfig.type !== 'ArrayExpression' && eslintConfig.type !== 'CallExpression')
		return false;

	const prettier = js.common.parseExpression('prettier');
	const sveltePrettierConfig = js.common.parseExpression(`${svelteImportName}.configs.prettier`);

	const nodesToInsert = [];
	if (!js.common.contains(eslintConfig, prettier)) nodesToInsert.push(prettier);
	if (!js.common.contains(eslintConfig, sveltePrettierConfig))
		nodesToInsert.push(sveltePrettierConfig);

	const elements =
		eslintConfig.type === 'ArrayExpression' ? eslintConfig.elements : eslintConfig.arguments;
	// finds index of `svelte.configs["..."]`
	const idx = elements.findIndex(
		(el) =>
			el?.type === 'MemberExpression' &&
			el.object.type === 'MemberExpression' &&
			el.object.property.type === 'Identifier' &&
			el.object.property.name === 'configs' &&
			el.object.object.type === 'Identifier' &&
			el.object.object.name === svelteImportName
	);

	if (idx !== -1) {
		elements.splice(idx + 1, 0, ...nodesToInsert);
	} else {
		// append to the end as a fallback
		elements.push(...nodesToInsert);
	}
});

export function addToDemoPage(path: string, language: 'ts' | 'js'): (content: string) => string {
	return transforms.svelte(({ ast, js }) => {
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

		svelte.ensureScript(ast, { language });
		js.imports.addNamed(ast.instance!.content, { imports: ['resolve'], from: '$app/paths' });

		svelte.addFragment(ast, `<a href={resolve('/demo/${path}')}>${path}</a>`, {
			mode: 'prepend'
		});
	});
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
