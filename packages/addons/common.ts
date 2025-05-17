import { imports, exports, common } from '@sveltejs/cli-core/js';
import { parseScript, parseSvelte } from '@sveltejs/cli-core/parsers';
import process from 'node:process';

export function addEslintConfigPrettier(content: string): string {
	const { ast, generateCode } = parseScript(content);

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
	imports.addDefault(ast, 'eslint-plugin-svelte', svelteImportName);
	imports.addDefault(ast, 'eslint-config-prettier', 'prettier');

	const fallbackConfig = common.expressionFromString('[]');
	const defaultExport = exports.defaultExport(ast, fallbackConfig);
	const eslintConfig = defaultExport.value;
	if (eslintConfig.type !== 'ArrayExpression' && eslintConfig.type !== 'CallExpression')
		return content;

	const prettier = common.expressionFromString('prettier');
	const sveltePrettierConfig = common.expressionFromString(`${svelteImportName}.configs.prettier`);
	const configSpread = common.createSpreadElement(sveltePrettierConfig);

	const nodesToInsert = [];
	if (!common.hasNode(eslintConfig, prettier)) nodesToInsert.push(prettier);
	if (!common.hasNode(eslintConfig, configSpread)) nodesToInsert.push(configSpread);

	const elements =
		eslintConfig.type === 'ArrayExpression' ? eslintConfig.elements : eslintConfig.arguments;
	// finds index of `...svelte.configs["..."]`
	const idx = elements.findIndex(
		(el) =>
			el?.type === 'SpreadElement' &&
			el.argument.type === 'MemberExpression' &&
			el.argument.object.type === 'MemberExpression' &&
			el.argument.object.property.type === 'Identifier' &&
			el.argument.object.property.name === 'configs' &&
			el.argument.object.object.type === 'Identifier' &&
			el.argument.object.object.name === svelteImportName
	);

	if (idx !== -1) {
		elements.splice(idx + 1, 0, ...nodesToInsert);
	} else {
		// append to the end as a fallback
		elements.push(...nodesToInsert);
	}

	return generateCode();
}

export function addToDemoPage(content: string, path: string): string {
	const { template, generateCode } = parseSvelte(content);

	for (const node of template.ast.childNodes) {
		if (node.type === 'tag' && node.attribs['href'] === `/demo/${path}`) {
			return content;
		}
	}

	const newLine = template.source ? '\n' : '';
	const src = template.source + `${newLine}<a href="/demo/${path}">${path}</a>`;
	return generateCode({ template: src });
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
