/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	imports.addNamed(ast, { from: 'package', imports: { namedOne: 'namedOne' }, isType: false });

	imports.addNamed(ast, { from: '@sveltejs/kit', imports: { Handle: 'Handle' }, isType: false });
	// adding the same import twice should not produce two imports
	imports.addNamed(ast, { from: '@sveltejs/kit', imports: { Handle: 'Handle' }, isType: false });

	imports.addNamed(ast, { from: 'xyz', imports: { foo: 'bar', baz: 'baz' } });
}
