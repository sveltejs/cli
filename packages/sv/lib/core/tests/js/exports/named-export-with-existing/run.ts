import { common, variables, object, exports, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	const variableFallback = variables.declaration(ast, {
		kind: 'const',
		name: 'variable',
		value: object.create({})
	});

	const existingExport = exports.createNamed(ast, {
		name: 'named',
		fallback: variableFallback
	});
	const variableDeclaration = existingExport?.declaration as AstTypes.VariableDeclaration;
	const variableDeclarator = variableDeclaration.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = variableDeclarator.init as AstTypes.ObjectExpression;

	object.property(objectExpression, {
		name: 'test2',
		fallback: common.createLiteral('string2')
	});
}
