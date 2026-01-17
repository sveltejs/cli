/** @import { SvelteAst } from '../../../../tooling/index.js' */

import { addAtRule } from '../../../../tooling/css/index.js';

/** @param {SvelteAst.CSS.StyleSheet} ast */
export function run(ast) {
	addAtRule(ast, { name: 'tailwind', params: "'lib/path/file.ext'", append: false });
	addAtRule(ast, { name: 'tailwind', params: "'lib/path/file1.ext'", append: true });
}
