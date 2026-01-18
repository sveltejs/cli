import { areNodesEqual } from './common.js';

/** @typedef {import("../index.ts").AstTypes.ArrayExpression} ArrayExpression */
/** @typedef {import("../index.ts").AstTypes.Expression} Expression */
/** @typedef {import("../index.ts").AstTypes.SpreadElement} SpreadElement */
/** @typedef {import("../index.ts").AstTypes.Literal} Literal */

/**
 * @returns {ArrayExpression}
 */
export function create() {
	/** @type {ArrayExpression} */
	const arrayExpression = {
		type: 'ArrayExpression',
		elements: []
	};
	return arrayExpression;
}

/**
 * @param {ArrayExpression} node
 * @param {string | Expression | SpreadElement} element
 */
export function append(node, element) {
	insertElement(node, element, { insertEnd: true });
}

/**
 * @param {ArrayExpression} node
 * @param {string | Expression | SpreadElement} element
 */
export function prepend(node, element) {
	insertElement(node, element, { insertEnd: false });
}

/**
 * @param {ArrayExpression} node
 * @param {string | Expression | SpreadElement} element
 * @param {{ insertEnd: boolean }} options
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
