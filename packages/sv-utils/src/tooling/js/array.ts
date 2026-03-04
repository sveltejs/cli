import type { AstTypes } from '../index.ts';
import { areNodesEqual } from './common.ts';

export function create(): AstTypes.ArrayExpression {
	const arrayExpression: AstTypes.ArrayExpression = {
		type: 'ArrayExpression',
		elements: []
	};
	return arrayExpression;
}

export function append(
	node: AstTypes.ArrayExpression,
	element: string | AstTypes.Expression | AstTypes.SpreadElement
): void {
	insertElement(node, element, { insertEnd: true });
}

export function prepend(
	node: AstTypes.ArrayExpression,
	element: string | AstTypes.Expression | AstTypes.SpreadElement
): void {
	insertElement(node, element, { insertEnd: false });
}

function insertElement(
	node: AstTypes.ArrayExpression,
	element: string | AstTypes.Expression | AstTypes.SpreadElement,
	options: { insertEnd: boolean }
): void {
	const astNode = node as AstTypes.Node;
	if (astNode.type !== 'ArrayExpression') {
		const detail = astNode.type === 'Identifier' ? ` "${astNode.name}"` : '';
		throw new Error(`Expected an ArrayExpression but got ${astNode.type}${detail}`);
	}
	if (typeof element === 'string') {
		const existingLiterals = node.elements.filter(
			(item) => item !== null && item.type === 'Literal'
		);
		let literal = existingLiterals.find((item) => item.value === element);
		if (!literal) {
			literal = { type: 'Literal', value: element };

			if (options.insertEnd) node.elements.push(literal);
			else node.elements.unshift(literal);
		}
	} else {
		const elements = node.elements;
		const anyNodeEquals = elements.some((item) => item && areNodesEqual(element, item));

		if (!anyNodeEquals) {
			if (options.insertEnd) node.elements.push(element);
			else node.elements.unshift(element);
		}
	}
}
