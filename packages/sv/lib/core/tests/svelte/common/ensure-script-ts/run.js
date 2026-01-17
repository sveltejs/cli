/** @import { SvelteAst } from '../../../../../core.js' */

import { ensureScript } from '../../../../tooling/svelte/index.js';

/** @param {SvelteAst.Root} ast */
export function run(ast) {
	ensureScript(ast, { language: 'ts' });
}
