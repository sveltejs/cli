import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addEmpty(ast, { from: 'package/file.js' });
	imports.addDefault(ast, { from: 'package', as: 'MyPackage' });
	imports.addNamed(ast, { from: 'package2', imports: { Named: 'Named' } });
}
