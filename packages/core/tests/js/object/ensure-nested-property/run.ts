import { variables, object, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'test',
		value: object.create({})
	});
	const objectDeclarator = variable.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = objectDeclarator.init as AstTypes.ObjectExpression;
	object.overrideProperties(objectExpression, {
		a: { b: { c: '007' } }
	});
}
