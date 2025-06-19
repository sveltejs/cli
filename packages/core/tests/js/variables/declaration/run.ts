import { variables, common, object, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const testNumberVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'testNumber',
		value: common.createLiteral(2)
	});
	ast.body.push(testNumberVariable);

	const objectExpression = object.create({
		foo: common.createLiteral('bar')
	});
	const testObjectVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'testObject',
		value: objectExpression
	});
	ast.body.push(testObjectVariable);
}
