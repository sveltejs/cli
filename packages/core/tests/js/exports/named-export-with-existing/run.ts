import { common, variables, object, exports, type AstTypes } from '@sveltejs/cli-core/js';
import type { ScriptFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: ScriptFileEditor<any>): void {
	const variableFallback = variables.declaration(ast, 'const', 'variable', object.createEmpty());

	const existingExport = exports.namedExport(ast, 'named', variableFallback);
	const variableDeclaration = existingExport?.declaration as AstTypes.VariableDeclaration;
	const variableDeclarator = variableDeclaration.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = variableDeclarator.init as AstTypes.ObjectExpression;

	object.property(objectExpression, 'test2', common.createLiteral('string2'));
}
