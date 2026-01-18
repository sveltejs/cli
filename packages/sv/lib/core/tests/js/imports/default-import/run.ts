import { imports, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	imports.addDefault(ast, { from: 'package', as: 'MyPackage' });
}
