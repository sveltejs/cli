import { common, type AdditionalCommentMap, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program, additionalComments: AdditionalCommentMap): void {
	const functionDeclaration = ast.body[0] as AstTypes.FunctionDeclaration;

	common.addJsDocComment(functionDeclaration, additionalComments, {
		params: { 'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage' }
	});
}
