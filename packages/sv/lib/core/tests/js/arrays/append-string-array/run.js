/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { array, variables } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const array1 = array.create();
	array.append(array1, 'test');
	array.append(array1, 'test2');
	array.append(array1, 'test'); // make sure items are not duplicated

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'array',
		value: array1
	});
	ast.body.push(declaration);
}
