/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { array, object, variables } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const array1 = array.create();
	const object1 = object.create({ test: true });
	const object2 = object.create({ test2: 'string' });
	array.append(array1, object1);
	array.append(array1, object2);
	array.append(array1, object2); // avoid duplication

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, { kind: 'const', name: 'array', value: array1 });
	ast.body.push(declaration);
}
