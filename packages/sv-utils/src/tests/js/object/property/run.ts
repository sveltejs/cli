import type { AstTypes } from '../../../../tooling/index.ts';
import { object, common } from '../../../../tooling/js/index.ts';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program): void {
	const obj = getTestObjectExpression(ast);

	object.property(obj, {
		name: 'bar',
		fallback: common.createLiteral('string')
	});
}
