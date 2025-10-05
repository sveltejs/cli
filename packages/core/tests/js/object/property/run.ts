import { object, common, type AstTypes } from '@sveltejs/cli-core/js';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program): void {
	const obj = getTestObjectExpression(ast);

	object.property(obj, {
		name: 'bar',
		fallback: common.createLiteral('string')
	});
}
