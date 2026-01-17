/** @import { AstTypes, Comments } from '../../../../tooling/js/index.js' */

import { object, common } from '../../../../tooling/js/index.js';
import { getTestObjectExpression } from '../objectTestHelper.js';

/**
 * @param {AstTypes.Program} ast
 * @param {Comments} comments
 */
export function run(ast, comments) {
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
