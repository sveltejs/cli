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
		foo: common.createLiteral(1),
		bar: common.createLiteral('string')
	});
	const createdVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'created',
		value: createdObject
	});
	ast.body.push(createdVariable);

	const createdObject2 = object.create({
		foo: 1,
		bar: 'string',
		baz: undefined,
		object: {
			foo: 'hello',
			nested: {
				bar: 'world'
			}
		},
		array: [123, 'hello', { foo: 'bar', bool: true }, [456, '789']]
	});
	const createdVariable2 = variables.declaration(ast, {
		kind: 'const',
		name: 'created2',
		value: createdObject2
	});
	createdVariable2.leadingComments = [{ type: 'Line', value: ' prettier-ignore' }];
	ast.body.push(createdVariable2);
}
