import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	editor.imports.addDefault(editor.ast, 'package', 'MyPackage');
}
