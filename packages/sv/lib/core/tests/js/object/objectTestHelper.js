/** @import { AstTypes } from '../../../tooling/js/index.js' */

import { variables, object } from '../../../tooling/js/index.js';

/**
 * @param {AstTypes.Program} ast
 * @returns {AstTypes.ObjectExpression}
 */
export const getTestObjectExpression = (ast) => {
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'test',
		value: object.create({})
	});

	const objectDeclarator = /** @type {AstTypes.VariableDeclarator} */ (variable.declarations[0]);
	const objectExpression = /** @type {AstTypes.ObjectExpression} */ (objectDeclarator.init);

	return objectExpression;
};
