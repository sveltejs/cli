import type { AstKinds, AstTypes } from '@sveltejs/ast-tooling';

export function call(name: string, args: string[]): AstTypes.CallExpression {
	const callExpression: AstTypes.CallExpression = {
		type: 'CallExpression',
		callee: {
			type: 'Identifier',
			name
		},
		arguments: []
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
		arguments: []
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
	body: AstKinds.ExpressionKind | AstTypes.BlockStatement
): AstTypes.ArrowFunctionExpression {
	const arrowFunction: AstTypes.ArrowFunctionExpression = {
		type: 'ArrowFunctionExpression',
		async,
		body,
		params: []
	};

	return arrowFunction;
}

export function argumentByIndex<T extends AstKinds.ExpressionKind>(
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
