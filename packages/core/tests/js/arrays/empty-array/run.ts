import { array, variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const emptyArray = array.createEmpty();

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, 'const', 'array', emptyArray);
	ast.body.push(declaration);
}
