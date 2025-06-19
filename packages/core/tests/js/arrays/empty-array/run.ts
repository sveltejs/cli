import { array, variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const emptyArray = array.create();

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'array',
		value: emptyArray
	});
	ast.body.push(declaration);
}
