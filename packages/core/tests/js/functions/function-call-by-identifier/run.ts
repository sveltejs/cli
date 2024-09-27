import { functions, common } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const functionCall = functions.callByIdentifier('foo', ['a']);
	const expression = common.expressionStatement(functionCall);
	ast.body.push(expression);
}
