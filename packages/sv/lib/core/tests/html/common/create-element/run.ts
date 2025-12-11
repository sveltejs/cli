import {
	createElement,
	appendElement,
	insertElement,
	type SvelteAst
} from '../../../../tooling/html/index.ts';

export function run(ast: SvelteAst.Fragment): void {
	const emptySpan = createElement('span');
	insertElement(ast, emptySpan);
	appendElement(ast, emptySpan);
}
