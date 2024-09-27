import { div, appendElement, insertElement } from '@svelte-cli/core/html';
import type { HtmlFileEditor } from '@svelte-cli/core';

export function run({ ast }: HtmlFileEditor<any>): void {
	const emptyDiv = div();
	insertElement(ast.childNodes, emptyDiv);
	appendElement(ast.childNodes, emptyDiv);
}
