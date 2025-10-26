import { common, variables, type AdditionalCommentMap, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program, additionalComments: AdditionalCommentMap): void {
	const declaration = variables.declaration(ast, {
		kind: 'const',
		name: 'foo',
		value: { type: 'Literal', value: 42 }
	});

	common.addJsDocTypeComment(declaration, additionalComments, {
		type: 'number'
	});

	ast.body.push(declaration);
}
