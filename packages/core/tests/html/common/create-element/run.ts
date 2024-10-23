import { element, appendElement, insertElement } from '@sveltejs/cli-core/html';
import type { HtmlFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: HtmlFileEditor<any>): void {
	const emptySpan = element('span');
	insertElement(ast.childNodes, emptySpan);
	appendElement(ast.childNodes, emptySpan);
}
