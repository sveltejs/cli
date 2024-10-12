import { functions, common } from '@sveltejs/cli-core/js';
import type { ScriptFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const functionCall = functions.callByIdentifier('foo', ['a']);
	const expression = common.expressionStatement(functionCall);
	ast.body.push(expression);
}
