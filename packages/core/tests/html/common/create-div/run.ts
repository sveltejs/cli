import { div, appendElement, insertElement, type HtmlDocument } from '@sveltejs/cli-core/html';

export function run(ast: HtmlDocument): void {
	const emptyDiv = div();
	insertElement(ast.childNodes, emptyDiv);
	appendElement(ast.childNodes, emptyDiv);
}
