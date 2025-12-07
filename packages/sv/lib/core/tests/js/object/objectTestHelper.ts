import { variables, object, type AstTypes } from '../../../tooling/js/index.ts';

export const getTestObjectExpression = (ast: AstTypes.Program): AstTypes.ObjectExpression => {
	const variable = variables.declaration(ast, {
		kind: 'const',
		name: 'test',
		value: object.create({})
	});

	const objectDeclarator = variable.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = objectDeclarator.init as AstTypes.ObjectExpression;

	return objectExpression;
};
