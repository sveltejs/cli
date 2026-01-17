/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	imports.addEmpty(ast, { from: 'package/file.js' });
	imports.addDefault(ast, { from: 'package', as: 'MyPackage' });
	imports.addNamed(ast, { from: 'package2', imports: { Named: 'Named' } });
}
