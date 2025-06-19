import { common, variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'foo',
		value: { type: 'Literal', value: 42 }
	});

	common.addJsDocTypeComment(declaration, {
		type: 'number'
	});

	ast.body.push(declaration);
}
