import { array, variables } from '@sveltejs/cli-core/js';
import type { ScriptFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const array1 = array.createEmpty();
	array.push(array1, 'test');
	array.push(array1, 'test2');
	array.push(array1, 'test'); // make sure items are not duplicated

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, 'const', 'array', array1);
	ast.body.push(declaration);
}
