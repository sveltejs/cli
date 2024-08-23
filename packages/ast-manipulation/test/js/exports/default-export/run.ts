import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	const object = editor.object.create({
		test: editor.common.createLiteral('string')
	});
	const object2 = editor.object.create({
		test2: editor.common.createLiteral('string2')
	});

	editor.exports.defaultExport(editor.ast, object);

	// overwriting default export should work
	editor.exports.defaultExport(editor.ast, object2);
}
