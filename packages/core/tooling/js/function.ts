import type { AstTypes } from '../index.ts';

export function call(name: string, args: string[]): AstTypes.CallExpression {
	const callExpression: AstTypes.CallExpression = {
		type: 'CallExpression',
		callee: {
			type: 'Identifier',
			name
		},
		arguments: [],
		optional: false
	};

	for (const argument of args) {
		callExpression.arguments.push({
			type: 'Literal',
			value: argument
		});
	}

	return callExpression;
}

export function callByIdentifier(name: string, args: string[]): AstTypes.CallExpression {
	const callExpression: AstTypes.CallExpression = {
		type: 'CallExpression',
		callee: {
			type: 'Identifier',
			name
		},
		arguments: [],
		optional: false
	};

	for (const argument of args) {
		const identifier: AstTypes.Identifier = {
			type: 'Identifier',
			name: argument
		};
		callExpression.arguments.push(identifier);
	}

	return callExpression;
}

export function arrowFunction(
	async: boolean,
	body: AstTypes.Expression | AstTypes.BlockStatement
): AstTypes.ArrowFunctionExpression {
	const arrowFunction: AstTypes.ArrowFunctionExpression = {
		type: 'ArrowFunctionExpression',
		async,
		body,
		params: [],
		expression: body.type !== 'BlockStatement'
	};

	return arrowFunction;
}

export function argumentByIndex<T extends AstTypes.Expression>(
	ast: AstTypes.CallExpression,
	i: number,
	fallback: T
): T {
	if (i < ast.arguments.length) {
		return ast.arguments[i] as T;
	}

	ast.arguments.push(fallback);
	return fallback;
}
