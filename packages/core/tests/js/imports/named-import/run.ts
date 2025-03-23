import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addNamed(ast, 'package', { namedOne: 'namedOne' }, false);

	imports.addNamed(ast, '@sveltejs/kit', { Handle: 'Handle' }, false);
	// adding the same import twice should not produce two imports
	imports.addNamed(ast, '@sveltejs/kit', { Handle: 'Handle' }, false);
}
