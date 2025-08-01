import { common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const functionDeclaration = ast.body[0] as AstTypes.FunctionDeclaration;

	common.addJsDocComment(functionDeclaration, {
		params: { 'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage' }
	});
}
