/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { object, variables, exports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const object1 = object.create({
		test: 'string'
	});
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'object',
		value: object1
	});
	ast.body.push(variable);

	exports.createDefault(ast, {
		fallback: variables.createIdentifier('object')
	});
}
