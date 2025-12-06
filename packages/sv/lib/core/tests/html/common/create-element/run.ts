import {
	createElement,
	appendElement,
	insertElement,
	type HtmlDocument
} from '@sveltejs/cli-core/html';

export function run(ast: HtmlDocument): void {
	const emptySpan = createElement('span');
	insertElement(ast.childNodes, emptySpan);
	appendElement(ast.childNodes, emptySpan);
}
