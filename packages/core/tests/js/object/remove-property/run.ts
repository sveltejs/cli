import { variables, object, type AstTypes } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const variable = variables.declaration(ast, 'const', 'test', object.createEmpty());
	const objectDeclarator = variable.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = objectDeclarator.init as AstTypes.ObjectExpression;
	object.removeProperty(objectExpression, 'foo');
	object.removeProperty(objectExpression, 'bar');
}
