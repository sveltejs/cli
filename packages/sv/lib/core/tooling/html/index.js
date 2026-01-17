/** @import { SvelteAst } from '../index.js' */
import { parseHtml } from '../index.js';

/**
 * @param {string} tagName
 * @param {Record<string, string>} attributes
 * @returns {SvelteAst.RegularElement}
 */
export function createElement(tagName, attributes = {}) {
	/** @type {SvelteAst.RegularElement} */
	const element = {
		type: 'RegularElement',
		name: tagName,
		attributes: [],
		fragment: {
			type: 'Fragment',
			nodes: []
		},
		name_loc: { start: { column: 0, line: 0 }, end: { column: 0, line: 0 } },
		start: 0,
		end: 0
	};

	for (const [name, value] of Object.entries(attributes)) {
		addAttribute(element, name, value);
	}

	return element;
}

/**
 * @param {SvelteAst.RegularElement} element
 * @param {string} name
 * @param {string} value
 * @returns {void}
 */
export function addAttribute(element, name, value) {
	let existing = element.attributes.find(
		/** @returns {attr is SvelteAst.Attribute} */
		(attr) => attr.type === 'Attribute' && attr.name === name
	);

	if (!existing) {
		existing = {
			type: 'Attribute',
			name,
			value: [],
			start: 0,
			end: 0,
			name_loc: { start: { column: 0, line: 0 }, end: { column: 0, line: 0 } }
		};
		element.attributes.push(existing);
	}

	existing.value = [{ type: 'Text', data: value, raw: value, start: 0, end: 0 }];
}

/**
 * @param {SvelteAst.Fragment} fragment
 * @param {SvelteAst.Fragment['nodes'][0]} elementToInsert
 * @returns {void}
 */
export function insertElement(fragment, elementToInsert) {
	fragment.nodes.splice(0, 0, elementToInsert);
}

/**
 * @param {SvelteAst.Fragment} fragment
 * @param {SvelteAst.Fragment['nodes'][0]} elementToAppend
 * @returns {void}
 */
export function appendElement(fragment, elementToAppend) {
	fragment.nodes.push(elementToAppend);
}

/**
 * @param {SvelteAst.Fragment} fragment
 * @param {string} html
 * @returns {void}
 */
export function addFromRawHtml(fragment, html) {
	const document = parseHtml(html);
	for (const childNode of document.nodes) {
		fragment.nodes.push(childNode);
	}
}
