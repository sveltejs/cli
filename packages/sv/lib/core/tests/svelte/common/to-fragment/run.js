/** @import { SvelteAst } from '../../../../../core.js' */

import { svelte } from '../../../../../core.js';

/** @param {SvelteAst.Root} ast */
export function run(ast) {
	svelte.addFragment(ast, '<span>Appended Fragment</span>');
}
