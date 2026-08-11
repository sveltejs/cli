import type { AstTypes } from '../index.ts';

export function createCall(options: {
	name: string;
	/** String args become literals (or identifiers with `useIdentifiers`); expression nodes are passed through as-is. */
	args: Array<string | AstTypes.Expression>;
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

		if (typeof arg !== 'string') {
			argNode = arg;
		} else if (options.useIdentifiers) {
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
	params?: string[];
}): AstTypes.ArrowFunctionExpression {
	const arrowFunction: AstTypes.ArrowFunctionExpression = {
		type: 'ArrowFunctionExpression',
		async: options.async,
		body: options.body,
		params: (options.params ?? []).map((param) => ({
			type: 'Identifier',
			name: param
		})),
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
