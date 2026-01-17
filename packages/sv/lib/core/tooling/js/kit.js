/** @import { AstTypes } from '../index.js' */
import { Walker } from '../../../core.js';
import * as common from './common.js';
import * as exports from './exports.js';
import * as functions from './function.js';
import * as imports from './imports.js';
import * as variables from './variables.js';

/**
 * @param {AstTypes.TSProgram} node
 * @param {{ name: 'Error' | 'Locals' | 'PageData' | 'PageState' | 'Platform' }} options
 * @returns {AstTypes.TSInterfaceDeclaration}
 */
export function addGlobalAppInterface(node, options) {
	let globalDecl = node.body
		.filter((n) => n.type === 'TSModuleDeclaration')
		.find((m) => m.global && m.declare);

	if (!globalDecl) {
		globalDecl = common.parseFromString('declare global {}');
		node.body.push(/** @type {AstTypes.TSModuleDeclaration} */ (globalDecl));
	}

	if (globalDecl.body?.type !== 'TSModuleBlock') {
		throw new Error('Unexpected body type of `declare global` in `src/app.d.ts`');
	}
	/** @type {AstTypes.TSModuleDeclaration | undefined} */
	let app;
	/** @type {AstTypes.TSInterfaceDeclaration | undefined} */
	let interfaceNode;

	Walker.walk(/** @type {AstTypes.Node} */ (globalDecl), null, {
		TSModuleDeclaration(node, { next }) {
			if (node.id.type === 'Identifier' && node.id.name === 'App') {
				app = node;
			}
			next();
		},
		TSInterfaceDeclaration(node) {
			if (node.id.type === 'Identifier' && node.id.name === options.name) {
				interfaceNode = node;
			}
		}
	});

	if (!app) {
		app = common.parseFromString('namespace App {}');
		globalDecl.body.body.push(/** @type {AstTypes.TSModuleDeclaration} */ (app));
	}

	if (app.body?.type !== 'TSModuleBlock') {
		throw new Error('Unexpected body type of `namespace App` in `src/app.d.ts`');
	}

	if (!interfaceNode) {
		// add the interface if it's missing
		interfaceNode = common.parseFromString(`interface ${options.name} {}`);
		app.body.body.push(/** @type {AstTypes.TSInterfaceDeclaration} */ (interfaceNode));
	}

	return /** @type {AstTypes.TSInterfaceDeclaration} */ (interfaceNode);
}

/**
 * @param {AstTypes.Program} node
 * @param {{ language: 'ts' | 'js'; newHandleName: string; handleContent: string }} options
 * @returns {void}
 */
export function addHooksHandle(node, options) {
	if (options.language === 'ts') {
		imports.addNamed(node, {
			from: '@sveltejs/kit',
			imports: { Handle: 'Handle' },
			isType: true
		});
	}
	let isSpecifier = false;
	let handleName = 'handle';
	/** @type {AstTypes.ExportNamedDeclaration | undefined} */
	let exportDecl;
	/** @type {AstTypes.Declaration | undefined} */
	let originalHandleDecl;

	// We'll first visit all of the named exports and grab their references if they export `handle`.
	// This will grab export references for:
	// `export { handle }` & `export { foo as handle }`
	// `export const handle = ...`, & `export function handle() {...}`
	Walker.walk(/** @type {AstTypes.Node} */ (node), null, {
		ExportNamedDeclaration(declaration) {
			/** @type {AstTypes.Declaration | undefined} */
			let maybeHandleDecl;

			// `export { handle }` & `export { foo as handle }`
			const handleSpecifier = declaration.specifiers?.find(
				(specifier) =>
					specifier.exported.type === 'Identifier' && specifier.exported.name === 'handle'
			);
			if (
				handleSpecifier &&
				handleSpecifier.local.type === 'Identifier' &&
				handleSpecifier.exported.type === 'Identifier'
			) {
				isSpecifier = true;
				// we'll search for the local name in case it's aliased (e.g. `export { foo as handle }`)
				handleName = /** @type {string} */ (
					handleSpecifier.local?.name ?? handleSpecifier.exported.name
				);

				// find the definition
				const handleFunc = node.body.find((item) => isFunctionDeclaration(item, handleName));
				const handleVar = node.body.find((item) => isVariableDeclaration(item, handleName));
				maybeHandleDecl = handleFunc ?? handleVar;
			}

			maybeHandleDecl ??= declaration.declaration ?? undefined;

			// `export const handle`
			if (maybeHandleDecl && isVariableDeclaration(maybeHandleDecl, handleName)) {
				exportDecl = declaration;
				originalHandleDecl = maybeHandleDecl;
			}

			// `export function handle`
			if (maybeHandleDecl && isFunctionDeclaration(maybeHandleDecl, handleName)) {
				exportDecl = declaration;
				originalHandleDecl = maybeHandleDecl;
			}
		}
	});

	const newHandle = common.parseExpression(options.handleContent);
	if (common.contains(node, newHandle)) return;
	// This is the straightforward case. If there's no existing `handle`, we'll just add one
	// with the new handle's definition and exit
	if (!originalHandleDecl || !exportDecl) {
		const newHandleDecl = variables.declaration(node, {
			kind: 'const',
			name: options.newHandleName,
			value: newHandle
		});

		if (options.language === 'ts') {
			const declarator = /** @type {AstTypes.VariableDeclarator} */ (newHandleDecl.declarations[0]);
			variables.typeAnnotateDeclarator(declarator, { typeName: 'Handle' });
		}
		node.body.push(newHandleDecl);

		const handleDecl = variables.declaration(node, {
			kind: 'const',
			name: handleName,
			value: variables.createIdentifier(options.newHandleName)
		});

		if (options.language === 'ts') {
			const declarator = /** @type {AstTypes.VariableDeclarator} */ (handleDecl.declarations[0]);
			variables.typeAnnotateDeclarator(declarator, { typeName: 'Handle' });
		}

		exports.createNamed(node, {
			name: handleName,
			fallback: handleDecl
		});
		return;
	}

	// create the new handle
	const newHandleDecl = variables.declaration(node, {
		kind: 'const',
		name: options.newHandleName,
		value: newHandle
	});
	if (options.language === 'ts') {
		const declarator = /** @type {AstTypes.VariableDeclarator} */ (newHandleDecl.declarations[0]);
		variables.typeAnnotateDeclarator(declarator, { typeName: 'Handle' });
	}

	// check if `handle` is using a sequence
	/** @type {AstTypes.CallExpression | undefined} */
	let sequence;
	if (originalHandleDecl.type === 'VariableDeclaration') {
		const handle = /** @type {AstTypes.VariableDeclarator | undefined} */ (
			originalHandleDecl.declarations.find(
				(declarator) =>
					declarator.type === 'VariableDeclarator' && usingSequence(declarator, handleName)
			)
		);

		sequence = /** @type {AstTypes.CallExpression} */ (handle?.init);
	}
	// If `handle` is already using a `sequence`, then we'll just create the new handle and
	// append the new handle name to the args of `sequence`
	// e.g. `export const handle = sequence(some, other, handles, newHandle);`
	if (sequence) {
		const hasNewArg = sequence.arguments.some(
			(arg) => arg.type === 'Identifier' && arg.name === options.newHandleName
		);
		if (!hasNewArg) {
			sequence.arguments.push(variables.createIdentifier(options.newHandleName));
		}

		// removes the declarations so we can append them in the correct order
		node.body = node.body.filter(
			(item) => item !== originalHandleDecl && item !== exportDecl && item !== newHandleDecl
		);
		if (isSpecifier) {
			// if export specifiers are being used (e.g. `export { handle }`), then we'll want
			// need to also append original handle declaration as it's not part of the export declaration
			node.body.push(newHandleDecl, originalHandleDecl, exportDecl);
		} else {
			node.body.push(newHandleDecl, exportDecl);
		}
	}
	// At this point, the existing `handle` doesn't call `sequence`, so we'll need to rename the original
	// `handle` and create a new `handle` that uses `sequence`
	// e.g. `const handle = sequence(originalHandle, newHandle);`
	const NEW_HANDLE_NAME = 'originalHandle';

	const sequenceCall = functions.createCall({
		name: 'sequence',
		args: [NEW_HANDLE_NAME, options.newHandleName],
		useIdentifiers: true
	});

	const finalHandleDecl = variables.declaration(node, {
		kind: 'const',
		name: handleName,
		value: sequenceCall
	});

	imports.addNamed(node, {
		from: '@sveltejs/kit/hooks',
		imports: { sequence: 'sequence' }
	});
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
		originalHandleDecl.id.name = NEW_HANDLE_NAME;
	}

	// removes all declarations so that we can re-append them in the correct order
	node.body = node.body.filter(
		(item) => item !== originalHandleDecl && item !== exportDecl && item !== newHandleDecl
	);

	if (isSpecifier) {
		node.body.push(originalHandleDecl, newHandleDecl, finalHandleDecl, exportDecl);
	}
	if (exportDecl.declaration && renameRequired) {
		// when we re-append the declarations, we only want to add the declaration
		// of the (now renamed) original `handle` _without_ the `export` keyword:
		// e.g. `const originalHandle = ...;`
		node.body.push(exportDecl.declaration, newHandleDecl);
		// `export const handle = sequence(originalHandle, newHandle);`
		exports.createNamed(node, {
			name: handleName,
			fallback: finalHandleDecl
		});
	} else if (exportDecl.declaration && isVariableDeclaration(originalHandleDecl, handleName)) {
		// if the previous value of `export const handle = ...` was an identifier
		// there is no need to rename the handle, we just need to add it to the sequence
		const variableDeclarator = /** @type {AstTypes.VariableDeclarator} */ (
			getVariableDeclarator(originalHandleDecl, handleName)
		);
		const sequenceCall = functions.createCall({
			name: 'sequence',
			args: [
				/** @type {AstTypes.Identifier} */ (variableDeclarator.init).name,
				options.newHandleName
			],
			useIdentifiers: true
		});
		const finalHandleDecl = variables.declaration(node, {
			kind: 'const',
			name: handleName,
			value: sequenceCall
		});
		if (options.language === 'ts') {
			const declarator = /** @type {AstTypes.VariableDeclarator} */ (
				finalHandleDecl.declarations[0]
			);
			variables.typeAnnotateDeclarator(declarator, { typeName: 'Handle' });
		}
		node.body.push(newHandleDecl);
		exports.createNamed(node, {
			name: handleName,
			fallback: finalHandleDecl
		});
	}
}

/**
 * @param {AstTypes.VariableDeclarator} node
 * @param {string} handleName
 * @returns {boolean}
 */
function usingSequence(node, handleName) {
	return (
		node.id.type === 'Identifier' &&
		node.id.name === handleName &&
		node.init?.type === 'CallExpression' &&
		node.init.callee.type === 'Identifier' &&
		node.init.callee.name === 'sequence'
	);
}

/**
 * @param {AstTypes.Node} node
 * @param {string} variableName
 * @returns {node is AstTypes.VariableDeclaration}
 */
function isVariableDeclaration(node, variableName) {
	return (
		node.type === 'VariableDeclaration' && getVariableDeclarator(node, variableName) !== undefined
	);
}

/**
 * @param {AstTypes.VariableDeclaration} node
 * @param {string} variableName
 * @returns {AstTypes.VariableDeclarator | undefined}
 */
function getVariableDeclarator(node, variableName) {
	return /** @type {AstTypes.VariableDeclarator | undefined} */ (
		node.declarations.find(
			(d) =>
				d.type === 'VariableDeclarator' && d.id.type === 'Identifier' && d.id.name === variableName
		)
	);
}

/**
 * @param {AstTypes.Node} node
 * @param {string} funcName
 * @returns {node is AstTypes.FunctionDeclaration}
 */
function isFunctionDeclaration(node, funcName) {
	return node.type === 'FunctionDeclaration' && node.id?.name === funcName;
}
