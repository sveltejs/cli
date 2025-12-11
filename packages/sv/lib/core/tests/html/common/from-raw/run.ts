import { addFromRawHtml, type SvelteAst } from '../../../../tooling/html/index.ts';

export function run(ast: SvelteAst.Fragment): void {
	addFromRawHtml(ast, '<div style="display: flex" data-foo="bar">foo</div>');
}
