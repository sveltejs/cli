import type { HtmlAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, div, appendElement, insertElement }: HtmlAstEditor): void {
	const emptyDiv = div();
	insertElement(ast.childNodes, emptyDiv);
	appendElement(ast.childNodes, emptyDiv);
}
