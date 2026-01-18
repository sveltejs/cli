import { common, type Comments, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program, comments: Comments): void {
	const functionDeclaration = ast.body[0] as AstTypes.FunctionDeclaration;

	common.addJsDocComment(functionDeclaration, comments, {
		params: { 'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage' }
	});

	// Adding 2 times the same comment should not add it twice!
	common.addJsDocComment(functionDeclaration, comments, {
		params: { 'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage' }
	});
}
