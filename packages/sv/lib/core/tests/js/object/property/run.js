/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { object, common } from '../../../../tooling/js/index.js';
import { getTestObjectExpression } from '../objectTestHelper.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const obj = getTestObjectExpression(ast);

	object.property(obj, {
		name: 'bar',
		fallback: common.createLiteral('string')
	});
}
