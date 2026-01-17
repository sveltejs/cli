/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { functions, common } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const functionCall = functions.createCall({
		name: 'foo',
		args: ['a'],
		useIdentifiers: true
	});
	const expression = common.createExpressionStatement({ expression: functionCall });
	ast.body.push(expression);
}
