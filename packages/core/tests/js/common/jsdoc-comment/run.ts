import { common } from '@svelte-cli/core/js';
import type { AstTypes, ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const functionDeclaration = ast.body[0] as AstTypes.FunctionDeclaration;

	common.addJsDocComment(functionDeclaration, {
		'import("$lib/paraglide/runtime").AvailableLanguageTag': 'newLanguage'
	});
}
