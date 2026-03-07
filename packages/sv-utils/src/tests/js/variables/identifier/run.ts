import type { AstTypes } from '../../../../tooling/index.ts';
import { variables } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const barVariable = variables.declaration(ast, {
		kind: 'const',
		name: 'bar',
		value: variables.createIdentifier('foo')
	});
	ast.body.push(barVariable);
}
