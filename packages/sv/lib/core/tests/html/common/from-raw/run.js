/** @import { SvelteAst } from '../../../../tooling/index.js' */

import { addFromRawHtml } from '../../../../tooling/html/index.js';

/** @param {SvelteAst.Fragment} ast */
export function run(ast) {
	addFromRawHtml(ast, '<div style="display: flex" data-foo="bar">foo</div>');
}
