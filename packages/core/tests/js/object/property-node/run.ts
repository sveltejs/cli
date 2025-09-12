import { object, common, type AstTypes } from '@sveltejs/cli-core/js';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program): void {
	const obj = getTestObjectExpression(ast);

	const p1 = object.propertyNode(obj, {
		name: 'foo',
		fallback: object.create({})
	});
	p1.leadingComments = [{ type: 'Block', value: 'a comment updated' }];

	const p2 = object.propertyNode(obj, {
		name: 'james',
		fallback: common.createLiteral('007')
	});
	p2.leadingComments = [{ type: 'Block', value: 'aka: bond, james bond' }];
}
