/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { object } from '../../../../tooling/js/index.js';
import { getTestObjectExpression } from '../objectTestHelper.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const obj = getTestObjectExpression(ast);

	object.overrideProperties(obj, {
		a: { b: { c: '007' } }
	});

	object.overrideProperties(obj, {
		a: { keep: 'you' }
	});
}
