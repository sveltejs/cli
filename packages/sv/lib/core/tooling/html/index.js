import { parseHtml } from '../index.ts';

/** @typedef {import("../index.ts").SvelteAst.RegularElement} RegularElement */
/** @typedef {import("../index.ts").SvelteAst.Attribute} Attribute */
/** @typedef {import("../index.ts").SvelteAst.Fragment} Fragment */

/**
 * @param {string} tagName
 * @param {Record<string, string>} [attributes={}]
 * @returns {RegularElement}
 */
export function createElement(tagName, attributes = {}) {
	/** @type {RegularElement} */
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
 * @param {RegularElement} element
 * @param {string} name
 * @param {string} value
 */
export function addAttribute(element, name, value) {
	/** @type {Attribute | undefined} */
	let existing = /** @type {Attribute | undefined} */ (
		element.attributes.find(
			(/** @type {any} */ attr) => attr?.type === 'Attribute' && attr?.name === name
		)
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
 * @param {Fragment} fragment
 * @param {Fragment['nodes'][0]} elementToInsert
 */
export function insertElement(fragment, elementToInsert) {
	fragment.nodes.splice(0, 0, elementToInsert);
}

/**
 * @param {Fragment} fragment
 * @param {Fragment['nodes'][0]} elementToAppend
 */
export function appendElement(fragment, elementToAppend) {
	fragment.nodes.push(elementToAppend);
}

/**
 * @param {Fragment} fragment
 * @param {string} html
 */
export function addFromRawHtml(fragment, html) {
	const document = parseHtml(html);
	for (const childNode of document.nodes) {
		fragment.nodes.push(childNode);
	}
}
