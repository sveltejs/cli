/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	imports.addEmpty(ast, { from: './relativ/file.css' });

	// allow importing from npm packages
	imports.addEmpty(ast, { from: 'package/file.css' });
}
