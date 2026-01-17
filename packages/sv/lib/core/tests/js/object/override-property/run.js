/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { object } from '../../../../tooling/js/index.js';
import { getTestObjectExpression } from '../objectTestHelper.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const obj = getTestObjectExpression(ast);

	object.overrideProperties(obj, { foo: 2 });
	object.overrideProperties(obj, { bar: 'string2', lorem: false });
}
