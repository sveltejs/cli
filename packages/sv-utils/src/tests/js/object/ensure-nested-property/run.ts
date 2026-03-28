import type { AstTypes } from '../../../../tooling/index.ts';
import { object } from '../../../../tooling/js/index.ts';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program): void {
	const obj = getTestObjectExpression(ast);

	object.overrideProperties(obj, {
		a: { b: { c: '007' } }
	});

	object.overrideProperties(obj, {
		a: { keep: 'you' }
	});
}
