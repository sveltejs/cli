import { variables, object, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'test',
		value: object.create({})
	});
	const objectDeclarator = variable.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = objectDeclarator.init as AstTypes.ObjectExpression;

	// Create the nested structure a.b.c = '007'
	object.overrideProperties(
		objectExpression,
		{
			a: { b: { c: '007' } }
		},
		(property) => {
			if (property.key.type !== 'Identifier' || property.key.name !== 'c') return property;

			property.leadingComments = [{ type: 'Block', value: 'aka: bond, james bond' }];
			return property;
		}
	);
}
