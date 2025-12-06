import { addFromRawHtml, type HtmlDocument } from '@sveltejs/cli-core/html';

export function run(ast: HtmlDocument): void {
	addFromRawHtml(ast.childNodes, '<div style="display: flex" data-foo="bar">foo</div>');
}
