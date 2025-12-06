import {
	createElement,
	appendElement,
	insertElement,
	type HtmlDocument
} from '../../../../tooling/html/index.ts';

export function run(ast: HtmlDocument): void {
	const emptySpan = createElement('span');
	insertElement(ast.childNodes, emptySpan);
	appendElement(ast.childNodes, emptySpan);
}
