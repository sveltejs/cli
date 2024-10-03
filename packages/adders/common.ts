import { imports, exports, common } from '@svelte-cli/core/js';
import { Walker, type AstTypes, type ScriptFileEditor } from '@svelte-cli/core';
import type { Question } from '@svelte-cli/core/internal';

export function addEslintConfigPrettier({ ast }: ScriptFileEditor<Record<string, Question>>) {
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
	const array = defaultExport.value;
	if (array.type !== 'ArrayExpression') return;

	const prettier = common.expressionFromString('prettier');
	const sveltePrettierConfig = common.expressionFromString(
		`${svelteImportName}.configs['flat/prettier']`
	);
	const configSpread = common.createSpreadElement(sveltePrettierConfig);

	const nodesToInsert = [];
	if (!common.hasNode(array, prettier)) nodesToInsert.push(prettier);
	if (!common.hasNode(array, configSpread)) nodesToInsert.push(configSpread);

	// finds index of `...svelte.configs["..."]`
	const idx = array.elements.findIndex(
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
		array.elements.splice(idx + 1, 0, ...nodesToInsert);
	} else {
		// append to the end as a fallback
		array.elements.push(...nodesToInsert);
	}
}

export function getOrCreateAppInterface(
	ast: AstTypes.Program,
	name: 'Error' | 'Locals' | 'PageData' | 'PageState' | 'Platform'
) {
	let globalDecl = ast.body
		.filter((n) => n.type === 'TSModuleDeclaration')
		.find((m) => m.global && m.declare);

	if (globalDecl && globalDecl?.body?.type !== 'TSModuleBlock') {
		throw new Error('Unexpected body type of `declare global` in `src/app.d.ts`');
	}

	if (!globalDecl) {
		const decl = common.statementFromString(`
			declare global {}`) as AstTypes.TSModuleDeclaration;
		ast.body.push(decl);
		globalDecl = decl;
	}

	if (!globalDecl || !globalDecl.body || !globalDecl.body.body) {
		throw new Error('Failed processing global declaration');
	}

	let app: AstTypes.TSModuleDeclaration | undefined;
	let interfaceNode: AstTypes.TSInterfaceDeclaration | undefined;

	// prettier-ignore
	Walker.walk(globalDecl as AstTypes.ASTNode, {}, {
		TSModuleDeclaration(node, { next }) {
			if (node.id.type === 'Identifier' && node.id.name === 'App') {
				app = node;
			}
			next();
		},
		TSInterfaceDeclaration(node) {
			if (node.id.type === 'Identifier' && node.id.name === name) {
				interfaceNode = node;
			}
		},
	});

	if (!app) {
		app ??= common.statementFromString('namespace App {}') as AstTypes.TSModuleDeclaration;
		(globalDecl.body as AstTypes.TSModuleBlock).body.push(app);
	}

	if (app.body?.type !== 'TSModuleBlock') {
		throw new Error('Unexpected body type of `namespace App` in `src/app.d.ts`');
	}

	if (!interfaceNode) {
		// add interface it if it's missing
		interfaceNode = common.statementFromString(
			`interface ${name} {}`
		) as AstTypes.TSInterfaceDeclaration;
		app.body.body.push(interfaceNode);
	}

	return interfaceNode;
}

export function hasTypeProp(
	name: string,
	node: AstTypes.TSInterfaceDeclaration['body']['body'][number]
) {
	return (
		node.type === 'TSPropertySignature' && node.key.type === 'Identifier' && node.key.name === name
	);
}
