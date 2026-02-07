import { addFromRawHtml } from '../../../../tooling/html/index.ts';
import type { SvelteAst } from '../../../../tooling/index.ts';

export function run(ast: SvelteAst.Fragment): void {
	addFromRawHtml(ast, '<div style="display: flex" data-foo="bar">foo</div>');
}
