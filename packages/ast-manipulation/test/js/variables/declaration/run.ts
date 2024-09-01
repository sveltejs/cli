import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, variables, common, object }: JsAstEditor): void {
	const testNumberVariable = variables.declaration(
		ast,
		'const',
		'testNumber',
		common.createLiteral(2)
	);
	ast.body.push(testNumberVariable);

	const objectExpression = object.create({
		foo: common.createLiteral('bar')
	});
	const testObjectVariable = variables.declaration(ast, 'const', 'testObject', objectExpression);
	ast.body.push(testObjectVariable);
}
