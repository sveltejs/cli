/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	imports.addNamed(ast, { from: 'package', imports: { namedTwo: 'namedTwo' }, isType: false });
}
