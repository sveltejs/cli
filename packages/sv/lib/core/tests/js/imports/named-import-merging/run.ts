import { imports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	imports.addNamed(ast, { from: 'package', imports: { namedTwo: 'namedTwo' }, isType: false });
}
