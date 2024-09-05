import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, functions, common }: JsAstEditor): void {
	const functionCall = functions.call('foo', ['bar']);
	const expression = common.expressionStatement(functionCall);
	ast.body.push(expression);
}
