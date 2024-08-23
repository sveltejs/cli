import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	editor.imports.addNamed(editor.ast, 'package', { namedTwo: 'namedTwo' }, false);
}
