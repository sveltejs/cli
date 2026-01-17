/** @import { SvelteAst } from '../../../../tooling/index.js' */

import { addAttribute } from '../../../../tooling/html/index.js';

/** @param {SvelteAst.Fragment} ast */
export function run(ast) {
	const element = /** @type {SvelteAst.RegularElement} */ (ast.nodes[0]);
	addAttribute(element, 'class', 'foo');
}
