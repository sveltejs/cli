import { variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const barVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'bar',
		value: variables.createIdentifier('foo')
	});
	ast.body.push(barVariable);
}
