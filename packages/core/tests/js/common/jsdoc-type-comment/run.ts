import { common, variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const declaration = variables.declaration(ast, 'const', 'foo', { type: 'Literal', value: 42 });

	common.addJsDocTypeComment(declaration, 'number');

	ast.body.push(declaration);
}
