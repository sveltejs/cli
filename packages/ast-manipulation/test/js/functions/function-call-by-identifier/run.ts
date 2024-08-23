import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, functions, common }: JsAstEditor): void {
	const functionCall = functions.callByIdentifier('foo', ['a']);
	const expression = common.expressionStatement(functionCall);
	ast.body.push(expression);
}
