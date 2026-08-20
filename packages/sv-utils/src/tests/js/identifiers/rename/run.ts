import type { AstTypes } from '../../../../tooling/index.ts';
import { identifiers } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	identifiers.renameReferences(
		[ast],
		new Map([
			['target', 'result'],
			['recurse', 'renamedRecurse']
		])
	);
}
