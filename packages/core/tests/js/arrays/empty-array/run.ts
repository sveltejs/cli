import { array, variables } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const emptyArray = array.createEmpty();

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, 'const', 'array', emptyArray);
	ast.body.push(declaration);
}
