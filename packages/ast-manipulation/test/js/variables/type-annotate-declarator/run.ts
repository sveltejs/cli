import type { JsAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, variables }: JsAstEditor): void {
	const decl = ast.body[0] as any;
	const annotatedDecl = variables.typeAnnotateDeclarator(decl.declarations[0], 'string');
	decl.declarations[0] = annotatedDecl;
}
