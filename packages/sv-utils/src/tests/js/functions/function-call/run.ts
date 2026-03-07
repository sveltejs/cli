import type { AstTypes } from '../../../../tooling/index.ts';
import { functions, common } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const functionCall = functions.createCall({
		name: 'foo',
		args: ['bar']
	});
	const expression = common.createExpressionStatement({ expression: functionCall });
	ast.body.push(expression);
}
