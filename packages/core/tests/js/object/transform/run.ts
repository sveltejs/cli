import { variables, object, common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'test',
		value: object.create({})
	});
	const objectDeclarator = variable.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = objectDeclarator.init as AstTypes.ObjectExpression;
	object.overrideProperty(objectExpression, {
		path: ['a', 'b', 'c'],
		value: common.createLiteral('007'),
		transform: (p) => {
			p.leadingComments = [{ type: 'Block', value: 'aka: bond, james bond' }];
			return p;
		}
	});
}
