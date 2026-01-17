/** @import { SvelteAst } from '../../../../../core.js' */

import { svelte } from '../../../../../core.js';

/** @param {SvelteAst.Root} ast */
export function run(ast) {
	svelte.ensureScript(ast);
}
