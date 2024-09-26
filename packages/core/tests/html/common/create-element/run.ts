import { element, appendElement, insertElement } from '@svelte-cli/core/html';
import type { HtmlFileEditor } from '@svelte-cli/core';

export function run({ ast }: HtmlFileEditor<any>): void {
	const emptySpan = element('span');
	insertElement(ast.childNodes, emptySpan);
	appendElement(ast.childNodes, emptySpan);
}
