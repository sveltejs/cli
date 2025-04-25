import {
	type AstTypes,
	type HtmlChildNode,
	type HtmlDocument,
	HtmlElement,
	HtmlElementType,
	parseHtml
} from '../index.ts';
import { addFromString } from '../js/common.ts';

export { HtmlElement, HtmlElementType };
export type { HtmlDocument };

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

export function addSlot(
	jsAst: AstTypes.Program,
	htmlAst: HtmlDocument,
	svelteVersion: string
): void {
	const slotSyntax =
		svelteVersion && (svelteVersion.startsWith('4') || svelteVersion.startsWith('3'));

	if (slotSyntax) {
		const slot = element('slot');
		appendElement(htmlAst.childNodes, slot);
		return;
	}

	addFromString(jsAst, 'let { children } = $props();');
	addFromRawHtml(htmlAst.childNodes, '{@render children()}');
}
