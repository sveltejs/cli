import { common, type AstTypes } from '@sveltejs/cli-core/js';

export function run({ ast }: { ast: AstTypes.Program }): void {
	const functionDeclaration = ast.body[0] as AstTypes.FunctionDeclaration;

	common.addJsDocComment(functionDeclaration, {
		'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage'
	});
}
