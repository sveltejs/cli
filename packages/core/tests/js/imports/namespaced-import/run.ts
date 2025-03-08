import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addNamespace(ast, 'package', 'foo');

	imports.addNamespace(ast, './some-file', 'bar');
	// adding the same import twice should not produce two imports
	imports.addNamespace(ast, './some-file', 'bar');
}
