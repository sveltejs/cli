import type { Comments, AstTypes } from '../../../../tooling/index.ts';
import { common, variables } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program, comments: Comments): void {
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'foo',
		value: { type: 'Literal', value: 42 }
	});

	common.addJsDocTypeComment(declaration, comments, {
		type: 'number'
	});

	ast.body.push(declaration);
}
