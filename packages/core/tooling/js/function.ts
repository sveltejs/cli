import type { AstTypes } from '../index.ts';

export function createCall(options: {
	name: string;
	args: string[];
	useIdentifiers?: boolean;
}): AstTypes.CallExpression {
	const callExpression: AstTypes.CallExpression = {
		type: 'CallExpression',
		callee: {
			type: 'Identifier',
			name: options.name
		},
		arguments: [],
		optional: false
	};

	for (const arg of options.args) {
		let argNode: AstTypes.Expression;

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

export function createArrow(options: {
	body: AstTypes.Expression | AstTypes.BlockStatement;
	async: boolean;
}): AstTypes.ArrowFunctionExpression {
	const arrowFunction: AstTypes.ArrowFunctionExpression = {
		type: 'ArrowFunctionExpression',
		async: options.async,
		body: options.body,
		params: [],
		expression: options.body.type !== 'BlockStatement'
	};

	return arrowFunction;
}

export function getArgument<T extends AstTypes.Expression>(
	node: AstTypes.CallExpression,
	options: { index: number; fallback: T }
): T {
	if (options.index < node.arguments.length) {
		return node.arguments[options.index] as T;
	}

	node.arguments.push(options.fallback);
	return options.fallback;
}
