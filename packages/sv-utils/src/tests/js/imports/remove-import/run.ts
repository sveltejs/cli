import type { AstTypes } from '../../../../tooling/index.ts';
import { imports } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	imports.remove(ast, { name: 'n2', from: 'p1' });
	imports.remove(ast, { name: 'n3', from: 'p3' });
}
