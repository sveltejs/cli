/** @import { AstTypes, Comments } from '../../../../tooling/js/index.js' */

import { common, variables } from '../../../../tooling/js/index.js';

/**
 * @param {AstTypes.Program} ast
 * @param {Comments} comments
 */
export function run(ast, comments) {
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'foo',
		value: { type: 'Literal', value: 42 }
	});

	common.addJsDocTypeComment(declaration, comments, {
		type: 'number'
	});

	ast.body.push(declaration);
}
