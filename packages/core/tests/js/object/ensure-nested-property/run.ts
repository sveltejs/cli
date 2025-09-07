import { object, type AstTypes } from '@sveltejs/cli-core/js';
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
