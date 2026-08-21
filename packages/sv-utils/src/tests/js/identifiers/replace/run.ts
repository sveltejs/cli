import type { AstTypes } from '../../../../tooling/index.ts';
import { identifiers } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	let count = 0;
	identifiers.replaceReferences([ast], ['target'], () => ({
		type: 'MemberExpression',
		object: { type: 'Identifier', name: 'source' },
		property: { type: 'Identifier', name: `value${++count}` },
		computed: false,
		optional: false
	}));
}
