import type { AstTypes } from '../../../../tooling/index.ts';
import { variables, object, common } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const emptyObject = object.create({});
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
	ast.body.push(createdVariable2);

	// objects with a `type` property must not be mistaken for AST nodes
	const createdObject3 = object.create({
		type: '123',
		nested: {
			type: 'something',
			value: 'inside'
		},
		array: [{ type: 'item', id: 1 }]
	});
	const createdVariable3 = variables.declaration(ast, {
		kind: 'const',
		name: 'created3',
		value: createdObject3
	});
	ast.body.push(createdVariable3);
}
