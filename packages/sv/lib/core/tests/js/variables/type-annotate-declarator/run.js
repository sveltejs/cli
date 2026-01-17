/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { variables } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const decl = /** @type {any} */ (ast.body[0]);
	const annotatedDecl = variables.typeAnnotateDeclarator(decl.declarations[0], {
		typeName: 'string'
	});
	decl.declarations[0] = annotatedDecl;
}
