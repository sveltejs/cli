/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { variables } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const barVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'bar',
		value: variables.createIdentifier('foo')
	});
	ast.body.push(barVariable);
}
