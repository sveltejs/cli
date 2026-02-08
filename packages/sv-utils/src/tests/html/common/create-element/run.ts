import { createElement, appendElement, insertElement } from '../../../../tooling/html/index.ts';
import type { SvelteAst } from '../../../../tooling/index.ts';

export function run(ast: SvelteAst.Fragment): void {
	const emptySpan = createElement('span');
	insertElement(ast, emptySpan);
	appendElement(ast, emptySpan);
}
