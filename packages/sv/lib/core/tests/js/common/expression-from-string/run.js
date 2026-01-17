/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { common, exports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	exports.createDefault(ast, {
		fallback: common.parseExpression(`
			defineConfig({
				path: "some/string/as/path.js",
				valid: true
			})
		`)
	});
}
