/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	imports.addNamespace(ast, { from: 'package', as: 'foo' });

	imports.addNamespace(ast, { from: './some-file', as: 'bar' });
	// adding the same import twice should not produce two imports
	imports.addNamespace(ast, { from: './some-file', as: 'bar' });
}
