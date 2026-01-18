/** @typedef {import("../index.ts").AstTypes} AstTypes */
/** @typedef {import("../index.ts").AstTypes.CallExpression} CallExpression */
/** @typedef {import("../index.ts").AstTypes.Expression} Expression */
/** @typedef {import("../index.ts").AstTypes.BlockStatement} BlockStatement */
/** @typedef {import("../index.ts").AstTypes.ArrowFunctionExpression} ArrowFunctionExpression */

/**
 * @param {{ name: string; args: string[]; useIdentifiers?: boolean }} options
 * @returns {CallExpression}
 */
export function createCall(options) {
	/** @type {CallExpression} */
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
		/** @type {Expression} */
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
 * @param {{ body: Expression | BlockStatement; async: boolean }} options
 * @returns {ArrowFunctionExpression}
 */
export function createArrow(options) {
	/** @type {ArrowFunctionExpression} */
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
 * @template {Expression} T
 * @param {CallExpression} node
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
