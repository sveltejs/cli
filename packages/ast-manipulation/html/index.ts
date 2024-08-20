import {
	type HtmlChildNode,
	type HtmlDocument,
	HtmlElement,
	HtmlElementType,
	parseHtml
} from '@svelte-cli/ast-tooling';

export type HtmlAstEditor = {
	ast: HtmlDocument;
	div: typeof div;
	element: typeof element;
	addFromRawHtml: typeof addFromRawHtml;
	insertElement: typeof insertElement;
	appendElement: typeof appendElement;
};

export function getHtmlAstEditor(document: HtmlDocument): HtmlAstEditor {
	const editor: HtmlAstEditor = {
		ast: document,
		div,
		addFromRawHtml,
		element,
		insertElement,
		appendElement
	};
	return editor;
}

function div(attributes: Record<string, string> = {}): HtmlElement {
	return element('div', attributes);
}

function element(tagName: string, attributes: Record<string, string> = {}): HtmlElement {
	const element = new HtmlElement(tagName, {}, undefined, HtmlElementType.Tag);
	element.attribs = attributes;
	return element;
}

function insertElement(childNodes: HtmlChildNode[], elementToInsert: HtmlChildNode): void {
	childNodes.splice(0, 0, elementToInsert);
}

function appendElement(childNodes: HtmlChildNode[], elementToAppend: HtmlChildNode): void {
	childNodes.push(elementToAppend);
}

function addFromRawHtml(childNodes: HtmlChildNode[], html: string): void {
	const document = parseHtml(html);
	for (const childNode of document.childNodes) {
		childNodes.push(childNode);
	}
}
