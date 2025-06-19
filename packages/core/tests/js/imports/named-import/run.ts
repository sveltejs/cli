import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addNamed(ast, { from: 'package', imports: { namedOne: 'namedOne' }, isType: false });

	imports.addNamed(ast, { from: '@sveltejs/kit', imports: { Handle: 'Handle' }, isType: false });
	// adding the same import twice should not produce two imports
	imports.addNamed(ast, { from: '@sveltejs/kit', imports: { Handle: 'Handle' }, isType: false });
}
