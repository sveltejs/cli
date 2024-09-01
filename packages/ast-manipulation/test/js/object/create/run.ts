import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, variables, object, common }: JsAstEditor): void {
	const emptyObject = object.createEmpty();
	const emptyVariable = variables.declaration(ast, 'const', 'empty', emptyObject);
	ast.body.push(emptyVariable);

	const createdObject = object.create({
		foo: common.createLiteral(1),
		bar: common.createLiteral('string')
	});
	const createdVariable = variables.declaration(ast, 'const', 'created', createdObject);
	ast.body.push(createdVariable);
}
