/** @import { SvelteAst } from '../../../../tooling/index.js' */

import { addDeclaration, addRule } from '../../../../tooling/css/index.js';

/** @param {SvelteAst.CSS.StyleSheet} ast */
export function run(ast) {
	const barSelectorRule = addRule(ast, {
		selector: 'bar'
	});
	addDeclaration(barSelectorRule, {
		property: 'color',
		value: 'blue'
	});
}
