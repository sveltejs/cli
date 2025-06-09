import { variables, object, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const emptyObject = object.createFromPrimitives({});
	const emptyVariable = variables.declaration(ast, 'const', 'empty', emptyObject);
	ast.body.push(emptyVariable);

	const createdObject = object.createFromPrimitives({
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
	const createdVariable = variables.declaration(ast, 'const', 'created', createdObject);
	ast.body.push(createdVariable);
}
