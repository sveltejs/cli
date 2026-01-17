/** @import { AstTypes, Comments } from '../../../../tooling/js/index.js' */

import { common } from '../../../../tooling/js/index.js';

/**
 * @param {AstTypes.Program} ast
 * @param {Comments} comments
 */
export function run(ast, comments) {
	const functionDeclaration = /** @type {AstTypes.FunctionDeclaration} */ (ast.body[0]);

	common.addJsDocComment(functionDeclaration, comments, {
		params: { 'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage' }
	});

	// Adding 2 times the same comment should not add it twice!
	common.addJsDocComment(functionDeclaration, comments, {
		params: { 'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage' }
	});
}
