import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, variables }: JsAstEditor): void {
	const barVariable = variables.declaration(ast, 'const', 'bar', variables.identifier('foo'));
	ast.body.push(barVariable);
}
