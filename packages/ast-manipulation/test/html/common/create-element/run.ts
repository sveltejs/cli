import type { HtmlAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, element, appendElement, insertElement }: HtmlAstEditor): void {
	const emptySpan = element('span');
	insertElement(ast.childNodes, emptySpan);
	appendElement(ast.childNodes, emptySpan);
}
