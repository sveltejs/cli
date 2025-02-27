import { variables, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const barVariable = variables.declaration(ast, 'const', 'bar', variables.identifier('foo'));
	ast.body.push(barVariable);
}
