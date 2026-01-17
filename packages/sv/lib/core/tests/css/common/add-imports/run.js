/** @import { SvelteAst } from '../../../../tooling/index.js' */

import { addImports } from '../../../../tooling/css/index.js';

/** @param {SvelteAst.CSS.StyleSheet} ast */
export function run(ast) {
	addImports(ast, {
		imports: ["'lib/path/file.css'"]
	});
}
