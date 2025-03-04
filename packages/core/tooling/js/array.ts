import { areNodesEqual } from './common.ts';
import type { AstTypes } from '@sveltejs/ast-tooling';

export function createEmpty(): AstTypes.ArrayExpression {
	const arrayExpression: AstTypes.ArrayExpression = {
		type: 'ArrayExpression',
		elements: []
	};
	return arrayExpression;
}

export function push(
	ast: AstTypes.ArrayExpression,
	data: string | AstTypes.Expression | AstTypes.SpreadElement
): void {
	if (typeof data === 'string') {
		const existingLiterals = ast.elements.filter(
			(x): x is AstTypes.Literal => x?.type == 'Literal'
		);
		let literal = existingLiterals.find((x) => x.value == data);

		if (!literal) {
			literal = {
				type: 'Literal',
				value: data
			};
			ast.elements.push(literal);
		}
	} else {
		let anyNodeEquals = false;
		const elements = ast.elements as AstTypes.Node[];
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
