import { variables } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const decl = ast.body[0] as any;
	const annotatedDecl = variables.typeAnnotateDeclarator(decl.declarations[0], 'string');
	decl.declarations[0] = annotatedDecl;
}
