import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	const emptyArray = editor.array.createEmpty();

	// create declaration so that we serialize everything
	const declaration = editor.variables.declaration(editor.ast, 'const', 'array', emptyArray);
	editor.ast.body.push(declaration);
}
