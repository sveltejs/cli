/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { variables, common, object } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const testNumberVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'testNumber',
		value: common.createLiteral(2)
	});
	ast.body.push(testNumberVariable);

	const objectExpression = object.create({
		foo: 'bar'
	});
	const testObjectVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'testObject',
		value: objectExpression
	});
	ast.body.push(testObjectVariable);
}
