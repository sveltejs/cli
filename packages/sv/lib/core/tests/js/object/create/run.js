/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { variables, object, common } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
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
}
