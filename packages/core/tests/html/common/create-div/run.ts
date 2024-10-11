import { div, appendElement, insertElement } from '@sveltejs/cli-core/html';
import type { HtmlFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: HtmlFileEditor<any>): void {
	const emptyDiv = div();
	insertElement(ast.childNodes, emptyDiv);
	appendElement(ast.childNodes, emptyDiv);
}
