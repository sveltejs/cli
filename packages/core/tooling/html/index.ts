import { type HtmlChildNode, HtmlElement, HtmlElementType, parseHtml } from '@sveltejs/ast-tooling';

export function div(attributes: Record<string, string> = {}): HtmlElement {
	return element('div', attributes);
}

export function element(tagName: string, attributes: Record<string, string> = {}): HtmlElement {
	const element = new HtmlElement(tagName, {}, undefined, HtmlElementType.Tag);
	element.attribs = attributes;
	return element;
}

export function insertElement(childNodes: HtmlChildNode[], elementToInsert: HtmlChildNode): void {
	childNodes.splice(0, 0, elementToInsert);
}

export function appendElement(childNodes: HtmlChildNode[], elementToAppend: HtmlChildNode): void {
	childNodes.push(elementToAppend);
}

export function addFromRawHtml(childNodes: HtmlChildNode[], html: string): void {
	const document = parseHtml(html);
	for (const childNode of document.childNodes) {
		childNodes.push(childNode);
	}
}
