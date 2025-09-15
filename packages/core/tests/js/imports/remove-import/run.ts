import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.remove(ast, { name: 'n2', from: 'p1' });
	imports.remove(ast, { name: 'n3', from: 'p3' });
}
