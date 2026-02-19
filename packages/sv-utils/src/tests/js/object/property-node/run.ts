import { object, common, type AstTypes, type Comments } from '../../../../tooling/js/index.ts';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program, comments: Comments): void {
	const obj = getTestObjectExpression(ast);

	const p1 = object.propertyNode(obj, {
		name: 'foo',
		fallback: object.create({})
	});
	comments.add(p1, { type: 'Block', value: 'a comment updated' });

	const p2 = object.propertyNode(obj, {
		name: 'james',
		fallback: common.createLiteral('007')
	});
	comments.add(p2, { type: 'Block', value: 'aka: bond, james bond' });
}
