import { addFromRawHtml } from '@svelte-cli/core/html';
import type { HtmlFileEditor } from '@svelte-cli/core';

export function run({ ast }: HtmlFileEditor<any>): void {
	addFromRawHtml(ast.childNodes, '<div style="display: flex" data-foo="bar">foo</div>');
}
