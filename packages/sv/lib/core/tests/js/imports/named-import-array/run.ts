import { imports, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	imports.addNamed(ast, { from: 'package', imports: ['namedOne'], isType: false });

	imports.addNamed(ast, { from: '@sveltejs/kit', imports: ['Handle'], isType: false });
	// adding the same import twice should not produce two imports
	imports.addNamed(ast, { from: '@sveltejs/kit', imports: ['Handle'], isType: false });
}
