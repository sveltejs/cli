/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	imports.addDefault(ast, { from: 'package', as: 'MyPackage' });
}
