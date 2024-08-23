import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	editor.imports.addEmpty(editor.ast, './relativ/file.css');

	// allow importing from npm packages
	editor.imports.addEmpty(editor.ast, 'package/file.css');
}
