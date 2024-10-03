import { imports, exports, common, variables, functions } from '@svelte-cli/core/js';
import { Walker, type AstKinds, type AstTypes, type ScriptFileEditor } from '@svelte-cli/core';
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

export function addHooksHandle(
	ast: AstTypes.Program,
	typescript: boolean,
	newHandleName: string,
	handleContent: string,
	forceSeperateHandle: boolean = false
) {
	if (typescript) {
		imports.addNamed(ast, '@sveltejs/kit', { Handle: 'Handle' }, true);
	}

	let isSpecifier: boolean = false;
	let handleName = 'handle';
	let exportDecl: AstTypes.ExportNamedDeclaration | undefined;
	let originalHandleDecl: AstKinds.DeclarationKind | undefined;

	// We'll first visit all of the named exports and grab their references if they export `handle`.
	// This will grab export references for:
	// `export { handle }` & `export { foo as handle }`
	// `export const handle = ...`, & `export function handle() {...}`
	// prettier-ignore
	Walker.walk(ast as AstTypes.ASTNode, {}, {
		ExportNamedDeclaration(node) {
			let maybeHandleDecl: AstKinds.DeclarationKind | undefined;

			// `export { handle }` & `export { foo as handle }`
			const handleSpecifier = node.specifiers?.find((s) => s.exported.name === 'handle');
			if (handleSpecifier) {
				isSpecifier = true;
				// we'll search for the local name in case it's aliased (e.g. `export { foo as handle }`)
				handleName = handleSpecifier.local?.name ?? handleSpecifier.exported.name;

				// find the definition
				const handleFunc = ast.body.find((n) => isFunctionDeclaration(n, handleName));
				const handleVar = ast.body.find((n) => isVariableDeclaration(n, handleName));

				maybeHandleDecl = handleFunc ?? handleVar;
			}

			maybeHandleDecl ??= node.declaration ?? undefined;

			// `export const handle`
			if (maybeHandleDecl && isVariableDeclaration(maybeHandleDecl, handleName)) {
				exportDecl = node;
				originalHandleDecl = maybeHandleDecl;
			}

			// `export function handle`
			if (maybeHandleDecl && isFunctionDeclaration(maybeHandleDecl, handleName)) {
				exportDecl = node;
				originalHandleDecl = maybeHandleDecl;
			}
		},
	});

	const newHandle = common.expressionFromString(handleContent);
	if (common.hasNode(ast, newHandle)) return;

	// This is the straightforward case. If there's no existing `handle`, we'll just add one
	// with the new handle's definition and exit
	if (!originalHandleDecl || !exportDecl) {
		// handle declaration doesn't exist, so we'll just create it with the hook
		const newDecl = variables.declaration(ast, 'const', handleName, newHandle);
		if (typescript) {
			const declarator = newDecl.declarations[0] as AstTypes.VariableDeclarator;
			variables.typeAnnotateDeclarator(declarator, 'Handle');
		}

		if (!forceSeperateHandle) exports.namedExport(ast, handleName, newDecl);
		else {
			const newDecl = variables.declaration(ast, 'const', newHandleName, newHandle);
			if (typescript) {
				const declarator = newDecl.declarations[0] as AstTypes.VariableDeclarator;
				variables.typeAnnotateDeclarator(declarator, 'Handle');
			}
			ast.body.push(newDecl);

			const handleDecl = variables.declaration(
				ast,
				'const',
				handleName,
				common.expressionFromString(newHandleName)
			);
			if (typescript) {
				const declarator = handleDecl.declarations[0] as AstTypes.VariableDeclarator;
				variables.typeAnnotateDeclarator(declarator, 'Handle');
			}
			exports.namedExport(ast, handleName, handleDecl);
		}

		return;
	}

	// create the new handle
	const newDecl = variables.declaration(ast, 'const', newHandleName, newHandle);
	if (typescript) {
		const declarator = newDecl.declarations[0] as AstTypes.VariableDeclarator;
		variables.typeAnnotateDeclarator(declarator, 'Handle');
	}

	// check if `handle` is using a sequence
	let sequence: AstTypes.CallExpression | undefined;
	if (originalHandleDecl.type === 'VariableDeclaration') {
		const handle = originalHandleDecl.declarations.find(
			(d) => d.type === 'VariableDeclarator' && usingSequence(d, handleName)
		) as AstTypes.VariableDeclarator | undefined;

		sequence = handle?.init as AstTypes.CallExpression;
	}

	// If `handle` is already using a `sequence`, then we'll just create the new handle and
	// append the new handle name to the args of `sequence`
	// e.g. `export const handle = sequence(some, other, handles, newHandle);`
	if (sequence) {
		const hasNewArg = sequence.arguments.some(
			(arg) => arg.type === 'Identifier' && arg.name === newHandleName
		);
		if (!hasNewArg) {
			sequence.arguments.push(variables.identifier(newHandleName));
		}

		// removes the declarations so we can append them in the correct order
		ast.body = ast.body.filter(
			(n) => n !== originalHandleDecl && n !== exportDecl && n !== newDecl
		);
		if (isSpecifier) {
			// if export specifiers are being used (e.g. `export { handle }`), then we'll want
			// need to also append original handle declaration as it's not part of the export declaration
			ast.body.push(newDecl, originalHandleDecl, exportDecl);
		} else {
			ast.body.push(newDecl, exportDecl);
		}

		return;
	}

	// At this point, the existing `handle` doesn't call `sequence`, so we'll need to rename the original
	// `handle` and create a new `handle` that uses `sequence`
	// e.g. `const handle = sequence(originalHandle, newHandle);`
	const NEW_HANDLE_NAME = 'originalHandle';
	const sequenceCall = functions.callByIdentifier('sequence', [NEW_HANDLE_NAME, newHandleName]);
	const newHandleDecl = variables.declaration(ast, 'const', handleName, sequenceCall);

	imports.addNamed(ast, '@sveltejs/kit/hooks', { sequence: 'sequence' });

	let renameRequired = false;
	// rename `export const handle`
	if (originalHandleDecl && isVariableDeclaration(originalHandleDecl, handleName)) {
		const handle = getVariableDeclarator(originalHandleDecl, handleName);
		if (handle && handle.id.type === 'Identifier' && handle.init?.type !== 'Identifier') {
			renameRequired = true;
			handle.id.name = NEW_HANDLE_NAME;
		}
	}
	// rename `export function handle`
	if (originalHandleDecl && isFunctionDeclaration(originalHandleDecl, handleName)) {
		renameRequired = true;
		originalHandleDecl.id!.name = NEW_HANDLE_NAME;
	}

	// removes all declarations so that we can re-append them in the correct order
	ast.body = ast.body.filter((n) => n !== originalHandleDecl && n !== exportDecl && n !== newDecl);

	if (isSpecifier) {
		ast.body.push(originalHandleDecl, newDecl, newHandleDecl, exportDecl);
	}

	if (exportDecl.declaration && renameRequired) {
		// when we re-append the declarations, we only want to add the declaration
		// of the (now renamed) original `handle` _without_ the `export` keyword:
		// e.g. `const originalHandle = ...;`
		ast.body.push(exportDecl.declaration, newDecl);
		// `export const handle = sequence(originalHandle, newHandle);`
		exports.namedExport(ast, handleName, newHandleDecl);
	} else if (exportDecl.declaration && isVariableDeclaration(originalHandleDecl, handleName)) {
		// if the previous value of `export const handle = ...` was an identifier
		// there is no need to rename the handle, we just need to add it to the sequence
		const variableDeclarator = getVariableDeclarator(originalHandleDecl, handleName);
		const sequenceCall = functions.callByIdentifier('sequence', [
			(variableDeclarator?.init as AstTypes.Identifier).name,
			newHandleName
		]);
		const newHandleDecl = variables.declaration(ast, 'const', handleName, sequenceCall);
		if (typescript) {
			const declarator = newHandleDecl.declarations[0] as AstTypes.VariableDeclarator;
			variables.typeAnnotateDeclarator(declarator, 'Handle');
		}
		ast.body.push(newDecl);
		exports.namedExport(ast, handleName, newHandleDecl);
	}
}

function usingSequence(node: AstTypes.VariableDeclarator, handleName: string) {
	return (
		node.id.type === 'Identifier' &&
		node.id.name === handleName &&
		node.init?.type === 'CallExpression' &&
		node.init.callee.type === 'Identifier' &&
		node.init.callee.name === 'sequence'
	);
}

function isVariableDeclaration(
	node: AstTypes.ASTNode,
	variableName: string
): node is AstTypes.VariableDeclaration {
	return (
		node.type === 'VariableDeclaration' && getVariableDeclarator(node, variableName) !== undefined
	);
}

function getVariableDeclarator(
	node: AstTypes.VariableDeclaration,
	handleName: string
): AstTypes.VariableDeclarator | undefined {
	return node.declarations.find(
		(d) => d.type === 'VariableDeclarator' && d.id.type === 'Identifier' && d.id.name === handleName
	) as AstTypes.VariableDeclarator | undefined;
}

function isFunctionDeclaration(
	node: AstTypes.ASTNode,
	funcName: string
): node is AstTypes.FunctionDeclaration {
	return node.type === 'FunctionDeclaration' && node.id?.name === funcName;
}
