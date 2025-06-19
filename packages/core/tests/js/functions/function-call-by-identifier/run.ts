import { functions, common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const functionCall = functions.createCall({
		name: 'foo',
		args: ['a'],
		useIdentifiers: true
	});
	const expression = common.createExpressionStatement({ expression: functionCall });
	ast.body.push(expression);
}
