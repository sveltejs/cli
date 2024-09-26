import { variables } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const barVariable = variables.declaration(ast, 'const', 'bar', variables.identifier('foo'));
	ast.body.push(barVariable);
}
