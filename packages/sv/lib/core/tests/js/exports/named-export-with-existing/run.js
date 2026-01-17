/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { common, variables, object, exports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const variableFallback = variables.declaration(ast, {
		kind: 'const',
		name: 'variable',
		value: object.create({})
	});

	const existingExport = exports.createNamed(ast, {
		name: 'named',
		fallback: variableFallback
	});
	const variableDeclaration = /** @type {AstTypes.VariableDeclaration} */ (
		existingExport?.declaration
	);
	const variableDeclarator = /** @type {AstTypes.VariableDeclarator} */ (
		variableDeclaration.declarations[0]
	);
	const objectExpression = /** @type {AstTypes.ObjectExpression} */ (variableDeclarator.init);

	object.property(objectExpression, {
		name: 'test2',
		fallback: common.createLiteral('string2')
	});
}
