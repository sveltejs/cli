import { functions, common } from '@sveltejs/cli-core/js';
import type { ScriptFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const functionCall = functions.call('foo', ['bar']);
	const expression = common.expressionStatement(functionCall);
	ast.body.push(expression);
}
