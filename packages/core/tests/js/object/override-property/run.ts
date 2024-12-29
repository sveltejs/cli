import { variables, object, common, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const variable = variables.declaration(ast, 'const', 'test', object.createEmpty());
	const objectDeclarator = variable.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = objectDeclarator.init as AstTypes.ObjectExpression;
	object.overrideProperty(objectExpression, 'foo', common.createLiteral(2));
	object.overrideProperties(objectExpression, {
		bar: common.createLiteral('string2'),
		lorem: common.createLiteral(false)
	});
}
