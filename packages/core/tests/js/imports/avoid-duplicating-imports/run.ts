import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addEmpty(ast, 'package/file.js');
	imports.addDefault(ast, 'package', 'MyPackage');
	imports.addNamed(ast, 'package2', { Named: 'Named' });
}
