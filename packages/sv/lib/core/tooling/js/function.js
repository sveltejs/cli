/** @import { AstTypes } from '../index.js' */

/**
 * @param {{ name: string; args: string[]; useIdentifiers?: boolean }} options
 * @returns {AstTypes.CallExpression}
 */
export function createCall(options) {
	/** @type {AstTypes.CallExpression} */
	const callExpression = {
		type: 'CallExpression',
		callee: {
			type: 'Identifier',
			name: options.name
		},
		arguments: [],
		optional: false
	};

	for (const arg of options.args) {
		/** @type {AstTypes.Expression} */
		let argNode;

		if (options.useIdentifiers) {
			argNode = {
				type: 'Identifier',
				name: arg
			};
		} else {
			argNode = {
				type: 'Literal',
				value: arg
			};
		}

		callExpression.arguments.push(argNode);
	}

	return callExpression;
}

/**
 * @param {{ body: AstTypes.Expression | AstTypes.BlockStatement; async: boolean }} options
 * @returns {AstTypes.ArrowFunctionExpression}
 */
export function createArrow(options) {
	/** @type {AstTypes.ArrowFunctionExpression} */
	const arrowFunction = {
		type: 'ArrowFunctionExpression',
		async: options.async,
		body: options.body,
		params: [],
		expression: options.body.type !== 'BlockStatement'
	};

	return arrowFunction;
}

/**
 * @template {AstTypes.Expression} T
 * @param {AstTypes.CallExpression} node
 * @param {{ index: number; fallback: T }} options
 * @returns {T}
 */
export function getArgument(node, options) {
	if (options.index < node.arguments.length) {
		return /** @type {T} */ (node.arguments[options.index]);
	}

	node.arguments.push(options.fallback);
	return options.fallback;
}
