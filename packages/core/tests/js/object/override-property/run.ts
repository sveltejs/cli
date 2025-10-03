import { object, type AstTypes } from '@sveltejs/cli-core/js';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program): void {
	const obj = getTestObjectExpression(ast);

	object.overrideProperties(obj, { foo: 2 });
	object.overrideProperties(obj, { bar: 'string2', lorem: false });
}
