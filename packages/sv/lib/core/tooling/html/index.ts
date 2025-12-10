import { parseHtml, type SvelteAst } from '../index.ts';

export type { SvelteAst };

export function createElement(
	tagName: string,
	attributes: Record<string, string> = {}
): SvelteAst.RegularElement {
	const element: SvelteAst.RegularElement = {
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

export function addAttribute(element: SvelteAst.RegularElement, name: string, value: string): void {
	let existing = element.attributes.find(
		(attr): attr is SvelteAst.Attribute => attr.type === 'Attribute' && attr.name === name
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

export function insertElement(
	fragment: SvelteAst.Fragment,
	elementToInsert: SvelteAst.Fragment['nodes'][0]
): void {
	fragment.nodes.splice(0, 0, elementToInsert);
}

export function appendElement(
	fragment: SvelteAst.Fragment,
	elementToAppend: SvelteAst.Fragment['nodes'][0]
): void {
	fragment.nodes.push(elementToAppend);
}

export function addFromRawHtml(fragment: SvelteAst.Fragment, html: string): void {
	const document = parseHtml(html);
	for (const childNode of document.nodes) {
		fragment.nodes.push(childNode);
	}
}
