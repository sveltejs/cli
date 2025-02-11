import { functions, common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const functionCall = functions.callByIdentifier('foo', ['a']);
	const expression = common.expressionStatement(functionCall);
	ast.body.push(expression);
}
