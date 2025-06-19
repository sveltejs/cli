import { array, variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const array1 = array.create();
	array.append(array1, { element: 'test' });
	array.append(array1, { element: 'test2' });
	array.append(array1, { element: 'test' }); // make sure items are not duplicated

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'array',
		value: array1
	});
	ast.body.push(declaration);
}
