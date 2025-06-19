import { variables, object, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const emptyObject = object.create({});
	const emptyVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'empty',
		value: emptyObject
	});
	ast.body.push(emptyVariable);

	const createdObject = object.create({
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
	const createdVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'created',
		value: createdObject
	});
	createdVariable.leadingComments = [{ type: 'Line', value: ' prettier-ignore' }];
	ast.body.push(createdVariable);
}
