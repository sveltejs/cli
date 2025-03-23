import { Walker, type AstTypes } from '../utils.ts';
import { common, functions, imports, variables, exports } from '../js/index.ts';

export function addGlobalAppInterface(
	ast: AstTypes.TSProgram,
	name: 'Error' | 'Locals' | 'PageData' | 'PageState' | 'Platform'
): AstTypes.TSInterfaceDeclaration {
	let globalDecl = ast.body
		.filter((n) => n.type === 'TSModuleDeclaration')
		.find((m) => m.global && m.declare);

	if (!globalDecl) {
		globalDecl = common.fromString<AstTypes.TSModuleDeclaration>('declare global {}');
		ast.body.push(globalDecl);
	}

	if (globalDecl.body?.type !== 'TSModuleBlock') {
		throw new Error('Unexpected body type of `declare global` in `src/app.d.ts`');
	}

	let app: AstTypes.TSModuleDeclaration | undefined;
	let interfaceNode: AstTypes.TSInterfaceDeclaration | undefined;

	Walker.walk(globalDecl as AstTypes.Node, null, {
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
		}
	});

	if (!app) {
		app = common.fromString<AstTypes.TSModuleDeclaration>('namespace App {}');
		globalDecl.body.body.push(app);
	}

	if (app.body?.type !== 'TSModuleBlock') {
		throw new Error('Unexpected body type of `namespace App` in `src/app.d.ts`');
	}

	if (!interfaceNode) {
		// add the interface if it's missing
		interfaceNode = common.fromString<AstTypes.TSInterfaceDeclaration>(`interface ${name} {}`);
		app.body.body.push(interfaceNode);
	}

	return interfaceNode;
}

export function addHooksHandle(
	ast: AstTypes.Program,
	typescript: boolean,
	newHandleName: string,
	handleContent: string
): void {
	if (typescript) {
		imports.addNamed(ast, '@sveltejs/kit', { Handle: 'Handle' }, true);
	}

	let isSpecifier: boolean = false;
	let handleName = 'handle';
	let exportDecl: AstTypes.ExportNamedDeclaration | undefined;
	let originalHandleDecl: AstTypes.Declaration | undefined;

	// We'll first visit all of the named exports and grab their references if they export `handle`.
	// This will grab export references for:
	// `export { handle }` & `export { foo as handle }`
	// `export const handle = ...`, & `export function handle() {...}`
	Walker.walk(ast as AstTypes.Node, null, {
		ExportNamedDeclaration(node) {
			let maybeHandleDecl: AstTypes.Declaration | undefined;

			// `export { handle }` & `export { foo as handle }`
			const handleSpecifier = node.specifiers?.find(
				(s) => s.exported.type === 'Identifier' && s.exported.name === 'handle'
			);
			if (
				handleSpecifier &&
				handleSpecifier.local.type === 'Identifier' &&
				handleSpecifier.exported.type === 'Identifier'
			) {
				isSpecifier = true;
				// we'll search for the local name in case it's aliased (e.g. `export { foo as handle }`)
				handleName = (handleSpecifier.local?.name ?? handleSpecifier.exported.name) as string;

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
		}
	});

	const newHandle = common.expressionFromString(handleContent);
	if (common.hasNode(ast, newHandle)) return;

	// This is the straightforward case. If there's no existing `handle`, we'll just add one
	// with the new handle's definition and exit
	if (!originalHandleDecl || !exportDecl) {
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
	node: AstTypes.Node,
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
	node: AstTypes.Node,
	funcName: string
): node is AstTypes.FunctionDeclaration {
	return node.type === 'FunctionDeclaration' && node.id?.name === funcName;
}
