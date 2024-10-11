import { variables } from '@sveltejs/cli-core/js';
import type { ScriptFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const barVariable = variables.declaration(ast, 'const', 'bar', variables.identifier('foo'));
	ast.body.push(barVariable);
}
