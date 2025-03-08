import { areNodesEqual } from './common.ts';
import type { AstKinds, AstTypes } from '@sveltejs/ast-tooling';

export function createEmpty(): AstTypes.ArrayExpression {
	const arrayExpression: AstTypes.ArrayExpression = {
		type: 'ArrayExpression',
		elements: []
	};
	return arrayExpression;
}

export function push(
	ast: AstTypes.ArrayExpression,
	data: string | AstKinds.ExpressionKind | AstKinds.SpreadElementKind
): void {
	insertElement(ast, data, true);
}
export function unshift(
	ast: AstTypes.ArrayExpression,
	data: string | AstKinds.ExpressionKind | AstKinds.SpreadElementKind
): void {
	insertElement(ast, data, false);
}

function insertElement(
	ast: AstTypes.ArrayExpression,
	data: string | AstKinds.ExpressionKind | AstKinds.SpreadElementKind,
	insertEnd: boolean
): void {
	if (typeof data === 'string') {
		const existingLiterals = ast.elements.filter((x) => x?.type === 'StringLiteral');
		const literal = existingLiterals.find((x) => x.value === data) ?? {
			type: 'StringLiteral',
			value: data
		};

		if (insertEnd) ast.elements.push(literal);
		else ast.elements.unshift(literal);
	} else {
		const elements = ast.elements as AstTypes.ASTNode[];
		const anyNodeEquals = elements.some((node) => areNodesEqual(data, node));

		if (!anyNodeEquals) {
			if (insertEnd) ast.elements.push(data);
			else ast.elements.unshift(data);
		}
	}
}
