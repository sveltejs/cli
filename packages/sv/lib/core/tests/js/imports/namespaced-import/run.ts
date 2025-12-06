import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addNamespace(ast, { from: 'package', as: 'foo' });

	imports.addNamespace(ast, { from: './some-file', as: 'bar' });
	// adding the same import twice should not produce two imports
	imports.addNamespace(ast, { from: './some-file', as: 'bar' });
}
