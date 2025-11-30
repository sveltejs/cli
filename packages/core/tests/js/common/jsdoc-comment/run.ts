import { common, type Comments, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program, comments: Comments): void {
	const functionDeclaration = ast.body[0] as AstTypes.FunctionDeclaration;

	common.addJsDocComment(functionDeclaration, comments, {
		params: { 'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage' }
	});
}
