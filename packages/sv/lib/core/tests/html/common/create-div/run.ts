import {
	createDiv,
	appendElement,
	insertElement,
	type HtmlDocument
} from '../../../../tooling/html/index.ts';

export function run(ast: HtmlDocument): void {
	const emptyDiv = createDiv();
	insertElement(ast.childNodes, emptyDiv);
	appendElement(ast.childNodes, emptyDiv);
}
