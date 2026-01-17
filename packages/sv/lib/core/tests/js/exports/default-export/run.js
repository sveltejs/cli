/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { object, exports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const object1 = object.create({
		test: 'string'
	});

	exports.createDefault(ast, {
		fallback: object1
	});
}
