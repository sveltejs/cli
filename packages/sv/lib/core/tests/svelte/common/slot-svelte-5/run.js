/** @import { SvelteAst } from '../../../../../core.js' */

import { svelte } from '../../../../../core.js';

/** @param {SvelteAst.Root} ast */
export function run(ast) {
	svelte.addSlot(ast, { svelteVersion: '5.0.0' });
}
