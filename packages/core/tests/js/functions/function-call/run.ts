import { functions, common } from '@svelte-cli/core/js';
import type { ScriptFileEditor } from '@svelte-cli/core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const functionCall = functions.call('foo', ['bar']);
	const expression = common.expressionStatement(functionCall);
	ast.body.push(expression);
}
