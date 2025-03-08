import { variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const decl = ast.body[0] as any;
	const annotatedDecl = variables.typeAnnotateDeclarator(decl.declarations[0], 'string');
	decl.declarations[0] = annotatedDecl;
}
