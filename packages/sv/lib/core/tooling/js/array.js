/** @import { AstTypes } from '../index.js' */
import { areNodesEqual } from './common.js';

/**
 * @returns {AstTypes.ArrayExpression}
 */
export function create() {
	/** @type {AstTypes.ArrayExpression} */
	const arrayExpression = {
		type: 'ArrayExpression',
		elements: []
	};
	return arrayExpression;
}

/**
 * @param {AstTypes.ArrayExpression} node
 * @param {string | AstTypes.Expression | AstTypes.SpreadElement} element
 * @returns {void}
 */
export function append(node, element) {
	insertElement(node, element, { insertEnd: true });
}

/**
 * @param {AstTypes.ArrayExpression} node
 * @param {string | AstTypes.Expression | AstTypes.SpreadElement} element
 * @returns {void}
 */
export function prepend(node, element) {
	insertElement(node, element, { insertEnd: false });
}

/**
 * @param {AstTypes.ArrayExpression} node
 * @param {string | AstTypes.Expression | AstTypes.SpreadElement} element
 * @param {{ insertEnd: boolean }} options
 * @returns {void}
 */
function insertElement(node, element, options) {
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
