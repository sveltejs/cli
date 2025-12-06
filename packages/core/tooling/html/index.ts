import {
	type HtmlChildNode,
	type HtmlDocument,
	HtmlElement,
	HtmlElementType,
	parseHtml
} from '../index.ts';

export { HtmlElement, HtmlElementType };
export type { HtmlDocument };

export function createDiv(attributes: Record<string, string> = {}): HtmlElement {
	return createElement('div', attributes);
}

export function createElement(
	tagName: string,
	attributes: Record<string, string> = {}
): HtmlElement {
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
