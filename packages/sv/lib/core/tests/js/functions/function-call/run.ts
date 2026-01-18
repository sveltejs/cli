import { functions, common, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	const functionCall = functions.createCall({
		name: 'foo',
		args: ['bar']
	});
	const expression = common.createExpressionStatement({ expression: functionCall });
	ast.body.push(expression);
}
