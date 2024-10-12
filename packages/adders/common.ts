import { imports, exports, common } from '@sveltejs/cli-core/js';
import { type Question, type FileEditor } from '@sveltejs/cli-core';
import { parseScript } from '@sveltejs/cli-core/parsers';

export function createPrinter(...conditions: boolean[]) {
	const printers = conditions.map((condition) => {
		return (content: string, alt = '') => (condition ? content : alt);
	});
	return printers;
}

export function addEslintConfigPrettier({ content }: FileEditor<Record<string, Question>>): string {
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
			svelteImportName = specifier.local.name;
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
	const sveltePrettierConfig = common.expressionFromString(
		`${svelteImportName}.configs['flat/prettier']`
	);
	const configSpread = common.createSpreadElement(sveltePrettierConfig);

	const nodesToInsert = [];
	if (!common.hasNode(eslintConfig, prettier)) nodesToInsert.push(prettier);
	if (!common.hasNode(eslintConfig, configSpread)) nodesToInsert.push(configSpread);

	const elements =
		eslintConfig.type == 'ArrayExpression' ? eslintConfig.elements : eslintConfig.arguments;
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
