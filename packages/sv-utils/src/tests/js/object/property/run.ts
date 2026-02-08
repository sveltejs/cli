import { object, common, type AstTypes } from '../../../../tooling/js/index.ts';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program): void {
	const obj = getTestObjectExpression(ast);

	object.property(obj, {
		name: 'bar',
		fallback: common.createLiteral('string')
	});
}
