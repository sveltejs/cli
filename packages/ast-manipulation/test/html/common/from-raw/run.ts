import type { HtmlAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, addFromRawHtml }: HtmlAstEditor): void {
	addFromRawHtml(ast.childNodes, '<div style="display: flex" data-foo="bar">foo</div>');
}
