import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, array, variables }: JsAstEditor): void {
	const emptyArray = array.createEmpty();

	// create declaration so that we serialize everything
	const declaration = variables.declaration(ast, 'const', 'array', emptyArray);
	ast.body.push(declaration);
}
