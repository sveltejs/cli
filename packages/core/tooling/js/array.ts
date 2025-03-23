import { areNodesEqual } from './common.ts';
import type { AstTypes } from '../tools.ts';

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
	insertElement(ast, data, true);
}
export function unshift(
	ast: AstTypes.ArrayExpression,
	data: string | AstTypes.Expression | AstTypes.SpreadElement
): void {
	insertElement(ast, data, false);
}

function insertElement(
	ast: AstTypes.ArrayExpression,
	data: string | AstTypes.Expression | AstTypes.SpreadElement,
	insertEnd: boolean
): void {
	if (typeof data === 'string') {
		const existingLiterals = ast.elements.filter((x) => x !== null && x.type === 'Literal');
		let literal = existingLiterals.find((x) => x.value === data);
		if (!literal) {
			literal = { type: 'Literal', value: data };

			if (insertEnd) ast.elements.push(literal);
			else ast.elements.unshift(literal);
		}
	} else {
		const elements = ast.elements;
		const anyNodeEquals = elements.some((node) => node && areNodesEqual(data, node));

		if (!anyNodeEquals) {
			if (insertEnd) ast.elements.push(data);
			else ast.elements.unshift(data);
		}
	}
}
