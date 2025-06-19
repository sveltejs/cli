import { functions, common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const insideExpression = common.parseExpression("console.log('foo')");
	const functionCall = functions.createArrow({
		body: insideExpression,
		async: false
	});
	const expression = common.createExpressionStatement({ expression: functionCall });
	ast.body.push(expression);

	const blockStatement = common.createBlockStatement();
	const insideExpression2 = common.parseExpression("console.log('foo');");
	const insideExpression3 = common.parseExpression("console.log('bar');");
	const expression2 = common.createExpressionStatement({ expression: insideExpression2 });
	const expression3 = common.createExpressionStatement({ expression: insideExpression3 });
	blockStatement.body.push(expression2);
	blockStatement.body.push(expression3);
	const functionCall2 = functions.createArrow({
		body: blockStatement,
		async: false
	});
	const expression4 = common.createExpressionStatement({ expression: functionCall2 });
	ast.body.push(expression4);
}
