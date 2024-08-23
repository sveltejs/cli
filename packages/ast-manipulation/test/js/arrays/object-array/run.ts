import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	const array = editor.array.createEmpty();

	const object = editor.object.create({ test: editor.common.expressionFromString('true') });
	const object2 = editor.object.create({ test2: editor.common.createLiteral('string') });
	editor.array.push(array, object);
	editor.array.push(array, object2);
	editor.array.push(array, object2); // avoid duplication

	// create declaration so that we serialize everything
	const declaration = editor.variables.declaration(editor.ast, 'const', 'array', array);
	editor.ast.body.push(declaration);
}
