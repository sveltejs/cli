import { array, variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const array1 = array.createEmpty();
	array.unshift(array1, 'test');
	array.unshift(array1, 'test2');
	array.unshift(array1, 'test'); // make sure items are not duplicated

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, 'const', 'array', array1);
	ast.body.push(declaration);
}
