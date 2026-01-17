/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	imports.remove(ast, { name: 'n2', from: 'p1' });
	imports.remove(ast, { name: 'n3', from: 'p3' });
}
