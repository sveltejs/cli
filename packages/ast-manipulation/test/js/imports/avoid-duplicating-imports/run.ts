import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	editor.imports.addEmpty(editor.ast, 'package/file.js');
	editor.imports.addDefault(editor.ast, 'package', 'MyPackage');
	editor.imports.addNamed(editor.ast, 'package2', { Named: 'Named' });
}
