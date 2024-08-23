import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, imports }: JsAstEditor): void {
	imports.addEmpty(ast, './relativ/file.css');

	// allow importing from npm packages
	imports.addEmpty(ast, 'package/file.css');
}
