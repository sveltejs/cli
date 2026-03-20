import type { AstTypes } from '../../../../tooling/index.ts';
import { imports } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	imports.addNamed(ast, { from: 'package', imports: { namedTwo: 'namedTwo' }, isType: false });
}
