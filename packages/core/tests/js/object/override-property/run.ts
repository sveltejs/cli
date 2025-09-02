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
		name: 'foo',
		value: common.createLiteral(2)
	});
	object.overrideProperties(objectExpression, [
		{ name: 'bar', value: common.createLiteral('string2') },
		{ name: 'lorem', value: common.createLiteral(false) }
	]);
}
