/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	imports.addNamed(ast, { from: 'package', imports: { namedOne: 'namedOneAlias' }, isType: false });

	const result = imports.find(ast, { name: 'namedOne', from: 'package' });

	if (result) {
		imports.addNamed(ast, {
			imports: [result.alias + 'Found'],
			from: 'package'
		});
	}
}
