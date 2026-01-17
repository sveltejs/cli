/** @import { AstTypes } from '../../../../tooling/js/index.js' */

import { imports, vite } from '../../../../tooling/js/index.js';

/** @param {AstTypes.Program} ast */
export function run(ast) {
	const vitePluginName = 'myPlugin';
	imports.addDefault(ast, { as: vitePluginName, from: 'my-plugin' });
	vite.addPlugin(ast, { code: `${vitePluginName}()`, mode: 'prepend' });
}
