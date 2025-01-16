import { variables, object, common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const emptyObject = object.createEmpty();
	const emptyVariable = variables.declaration(ast, 'const', 'empty', emptyObject);
	ast.body.push(emptyVariable);

	const createdObject = object.create({
		foo: common.createLiteral(1),
		bar: common.createLiteral('string')
	});
	const createdVariable = variables.declaration(ast, 'const', 'created', createdObject);
	ast.body.push(createdVariable);
}
