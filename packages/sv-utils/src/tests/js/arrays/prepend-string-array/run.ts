import { array, variables, type AstTypes } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const array1 = array.create();
	array.prepend(array1, 'test');
	array.prepend(array1, 'test2');
	array.prepend(array1, 'test'); // make sure items are not duplicated

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'array',
		value: array1
	});
	ast.body.push(declaration);
}
