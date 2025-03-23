import { functions, common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const insideExpression = common.expressionFromString("console.log('foo')");
	const functionCall = functions.arrowFunction(false, insideExpression);
	const expression = common.expressionStatement(functionCall);
	ast.body.push(expression);

	const blockStatement = common.blockStatement();
	const insideExpression2 = common.expressionFromString("console.log('foo');");
	const insideExpression3 = common.expressionFromString("console.log('bar');");
	const expression2 = common.expressionStatement(insideExpression2);
	const expression3 = common.expressionStatement(insideExpression3);
	blockStatement.body.push(expression2);
	blockStatement.body.push(expression3);
	const functionCall2 = functions.arrowFunction(false, blockStatement);
	const expression4 = common.expressionStatement(functionCall2);
	ast.body.push(expression4);
}
