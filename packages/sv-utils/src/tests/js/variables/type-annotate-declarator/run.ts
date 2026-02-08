import { variables, type AstTypes } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const decl = ast.body[0] as any;
	const annotatedDecl = variables.typeAnnotateDeclarator(decl.declarations[0], {
		typeName: 'string'
	});
	decl.declarations[0] = annotatedDecl;
}
