import { variables, object, common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const emptyObject = object.createEmpty();
	const emptyVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'empty',
		value: emptyObject
	});
	ast.body.push(emptyVariable);

	const createdObject = object.create({
		foo: common.createLiteral({ value: 1 }),
		bar: common.createLiteral({ value: 'string' })
	});
	const createdVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'created',
		value: createdObject
	});
	ast.body.push(createdVariable);
}
