import type { JsAstEditor } from '@svelte-cli/ast-manipulation';
import type { AstTypes } from '@svelte-cli/ast-tooling';

export function run({ ast, variables, object, common }: JsAstEditor): void {
	const variable = variables.declaration(ast, 'const', 'test', object.createEmpty());
	const objectDeclarator = variable.declarations[0] as AstTypes.VariableDeclarator;
	const objectExpression = objectDeclarator.init as AstTypes.ObjectExpression;

	object.property(objectExpression, 'bar', common.createLiteral('string'));
}
