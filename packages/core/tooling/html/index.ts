import {
	type AstTypes,
	type HtmlChildNode,
	type HtmlDocument,
	HtmlElement,
	HtmlElementType,
	parseHtml
} from '../index.ts';
import { appendFromString } from '../js/common.ts';

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

export function addSlot(
	jsAst: AstTypes.Program,
	options: { htmlAst: HtmlDocument; svelteVersion: string }
): void {
	const slotSyntax =
		options.svelteVersion &&
		(options.svelteVersion.startsWith('4') || options.svelteVersion.startsWith('3'));

	if (slotSyntax) {
		const slot = createElement('slot');
		appendElement(options.htmlAst.childNodes, slot);
		return;
	}

	appendFromString(jsAst, {
		code: 'let { children } = $props();'
	});
	addFromRawHtml(options.htmlAst.childNodes, '{@render children()}');
}
