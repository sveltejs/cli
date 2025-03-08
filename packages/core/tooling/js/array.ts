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
	if (typeof data === 'string') {
		const existingLiterals = ast.elements.filter(
			(x): x is AstTypes.StringLiteral => x?.type == 'StringLiteral'
		);
		let literal = existingLiterals.find((x) => x.value == data);

		if (!literal) {
			literal = {
				type: 'StringLiteral',
				value: data
			};
			ast.elements.push(literal);
		}
	} else {
		let anyNodeEquals = false;
		const elements = ast.elements as AstTypes.ASTNode[];
		for (const node of elements) {
			if (areNodesEqual(data, node)) {
				anyNodeEquals = true;
			}
		}

		if (!anyNodeEquals) {
			ast.elements.push(data);
		}
	}
}

export function unshift(
	ast: AstTypes.ArrayExpression,
	data: string | AstKinds.ExpressionKind | AstKinds.SpreadElementKind
): void {
	if (typeof data === 'string') {
		const existingLiterals = ast.elements.filter(
			(x): x is AstTypes.StringLiteral => x?.type == 'StringLiteral'
		);
		let literal = existingLiterals.find((x) => x.value == data);

		if (!literal) {
			literal = {
				type: 'StringLiteral',
				value: data
			};
			ast.elements.unshift(literal);
		}
	} else {
		let anyNodeEquals = false;
		const elements = ast.elements as AstTypes.ASTNode[];
		for (const node of elements) {
			if (areNodesEqual(data, node)) {
				anyNodeEquals = true;
			}
		}

		if (!anyNodeEquals) {
			ast.elements.unshift(data);
		}
	}

}