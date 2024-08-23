import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	const array = editor.array.createEmpty();
	editor.array.push(array, 'test');
	editor.array.push(array, 'test2');
	editor.array.push(array, 'test'); // make sure items are not duplicated

	// create declaration so that we serialize everything
	const declaration = editor.variables.declaration(editor.ast, 'const', 'array', array);
	editor.ast.body.push(declaration);
}
