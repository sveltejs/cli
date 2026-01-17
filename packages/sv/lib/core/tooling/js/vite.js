/** @import { AstTypes } from '../index.js' */
import * as array from './array.js';
import * as common from './common.js';
import * as exports from './exports.js';
import * as functions from './function.js';
import * as imports from './imports.js';
import * as object from './object.js';

/**
 * @param {AstTypes.CallExpression} callExpression
 * @param {string[]} knownWrappers
 * @returns {boolean}
 */
function isConfigWrapper(callExpression, knownWrappers) {
	// Check if this is a call to defineConfig or any function that looks like a config wrapper
	if (callExpression.callee.type !== 'Identifier') return false;

	const calleeName = callExpression.callee.name;

	// Check if it's a known wrapper
	if (knownWrappers.includes(calleeName)) return true;

	// Check if it's imported from 'vite' (this would require analyzing imports, but for now we'll be conservative)
	// For now, assume any function call with a single object argument is a config wrapper
	const isObjectCall =
		callExpression.arguments.length === 1 &&
		callExpression.arguments[0]?.type === 'ObjectExpression';

	return knownWrappers.includes(calleeName) || isObjectCall;
}

/**
 * @param {AstTypes.Program} ast
 * @param {{ fallback?: { code: string; additional?: (ast: AstTypes.Program) => void }; ignoreWrapper: string[] }} options
 * @returns {AstTypes.ObjectExpression}
 */
function exportDefaultConfig(ast, options) {
	const { fallback, ignoreWrapper } = options;

	// Get or create the default export
	/** @type {AstTypes.Expression} */
	let fallbackExpression;
	if (fallback) {
		fallbackExpression =
			typeof fallback.code === 'string' ? common.parseExpression(fallback.code) : fallback.code;
	} else {
		fallbackExpression = object.create({});
	}

	const { value, isFallback } = exports.createDefault(ast, { fallback: fallbackExpression });
	if (isFallback) {
		options.fallback?.additional?.(ast);
	}

	// Handle TypeScript `satisfies` expressions
	const rootObject = value.type === 'TSSatisfiesExpression' ? value.expression : value;

	// Handle wrapper functions (e.g., defineConfig({})) if ignoreWrapper is specified
	/** @type {AstTypes.ObjectExpression} */
	let configObject;

	// Early bail-out: if not a call expression
	if (!('arguments' in rootObject) || !Array.isArray(rootObject.arguments)) {
		configObject = /** @type {AstTypes.ObjectExpression} */ (rootObject);
		return configObject;
	}

	// Early bail-out: if not a call expression
	if (rootObject.type !== 'CallExpression' || rootObject.callee.type !== 'Identifier') {
		configObject = /** @type {AstTypes.ObjectExpression} */ (/** @type {unknown} */ (rootObject));
		return configObject;
	}

	// Check if this is a config wrapper function call
	if (!isConfigWrapper(/** @type {AstTypes.CallExpression} */ (rootObject), ignoreWrapper)) {
		configObject = /** @type {AstTypes.ObjectExpression} */ (/** @type {unknown} */ (rootObject));
		return configObject;
	}

	// Main logic: handle the wrapper function call
	// For wrapper function calls like defineConfig({}) or defineConfig(() => { return {}; })
	const firstArg = /** @type {AstTypes.Expression} */ (
		functions.getArgument(/** @type {AstTypes.CallExpression} */ (rootObject), {
			index: 0,
			fallback: object.create({})
		})
	);

	// Check if the first argument is an arrow function that returns an object
	if (firstArg.type === 'ArrowFunctionExpression') {
		const arrowFunction = /** @type {AstTypes.ArrowFunctionExpression} */ (
			/** @type {unknown} */ (firstArg)
		);
		// Handle arrow function case: defineConfig(() => { return { ... }; })
		if (arrowFunction.body.type === 'BlockStatement') {
			// Look for a return statement in the block
			const returnStatement = arrowFunction.body.body.find(
				/** @returns {stmt is AstTypes.ReturnStatement} */
				(stmt) => stmt.type === 'ReturnStatement'
			);

			if (returnStatement && returnStatement.argument?.type === 'ObjectExpression') {
				configObject = returnStatement.argument;
			} else {
				// If no return statement with object found, create fallback object and add return statement
				configObject = object.create({});
				/** @type {AstTypes.ReturnStatement} */
				const newReturnStatement = {
					type: 'ReturnStatement',
					argument: configObject
				};
				arrowFunction.body.body.push(newReturnStatement);
			}
		} else if (arrowFunction.body.type === 'ObjectExpression') {
			// Handle arrow function with expression body: defineConfig(() => ({ ... }))
			configObject = arrowFunction.body;
		} else {
			// Arrow function doesn't return an object, create fallback and modify the function
			configObject = object.create({});
			arrowFunction.body = configObject;
			arrowFunction.expression = true;
		}
	} else if (firstArg.type === 'ObjectExpression') {
		// Direct object argument: defineConfig({ ... })
		configObject = firstArg;
	} else {
		// Fallback case - create a new object
		configObject = object.create({});
	}

	return /** @type {AstTypes.ObjectExpression} */ (configObject);
}

/**
 * @param {AstTypes.ObjectExpression} ast
 * @param {{ arrayProperty: string; code: string; mode?: 'append' | 'prepend' }} options
 * @returns {void}
 */
function addInArrayOfObject(ast, options) {
	const { code, arrayProperty, mode = 'append' } = options;

	// Get or create the array property
	const targetArray = object.property(ast, {
		name: arrayProperty,
		fallback: array.create()
	});

	// Parse the expression
	const expression = common.parseExpression(code);

	// Add to array based on mode
	if (mode === 'prepend') {
		array.prepend(targetArray, expression);
	} else {
		array.append(targetArray, expression);
	}
}

/**
 * @param {AstTypes.Program} ast
 * @param {{ code: string; mode?: 'append' | 'prepend' }} options
 * @returns {void}
 */
export const addPlugin = (ast, options) => {
	// Step 1: Get the config object, or fallback.
	const configObject = getConfig(ast);

	// Step 2: Add the plugin to the plugins array
	addInArrayOfObject(configObject, {
		arrayProperty: 'plugins',
		...options
	});
};

/**
 * @param {AstTypes.Program} ast
 * @returns {AstTypes.ObjectExpression}
 */
export const getConfig = (ast) => {
	return exportDefaultConfig(ast, {
		fallback: {
			code: 'defineConfig()',
			additional: (ast) => imports.addNamed(ast, { imports: ['defineConfig'], from: 'vite' })
		},
		ignoreWrapper: ['defineConfig']
	});
};
