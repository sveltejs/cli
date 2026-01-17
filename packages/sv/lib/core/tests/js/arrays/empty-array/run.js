/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { array, variables } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const emptyArray = array.create();

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'array',
		value: emptyArray
	});
	ast.body.push(declaration);
}
