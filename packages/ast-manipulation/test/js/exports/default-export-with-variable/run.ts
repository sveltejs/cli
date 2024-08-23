import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run(editor: JsAstEditor): void {
	const object = editor.object.create({
		test: editor.common.createLiteral('string')
	});
	const variable = editor.variables.declaration(editor.ast, 'const', 'object', object);
	editor.ast.body.push(variable);

	editor.exports.defaultExport(editor.ast, editor.variables.identifier('object'));
}
