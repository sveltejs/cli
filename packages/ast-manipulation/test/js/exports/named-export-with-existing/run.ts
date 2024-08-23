import type { JsAstEditor } from '@svelte-cli/ast-manipulation';
import type { AstTypes } from '@svelte-cli/ast-tooling';

export function run({ ast, common, variables, object, exports }: JsAstEditor): void {
	const variableFallback = variables.declaration(ast, 'const', 'variable', object.createEmpty());

	const existingExport = exports.namedExport(ast, 'named', variableFallback);
	const variableDeclaration = existingExport?.declaration as AstTypes.VariableDeclaration;
	const variableDeclarator = variableDeclaration.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = variableDeclarator.init as AstTypes.ObjectExpression;

	object.property(objectExpression, 'test2', common.createLiteral('string2'));
}
