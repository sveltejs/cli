import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addDefault(ast, { from: 'package', as: 'MyPackage' });
}
