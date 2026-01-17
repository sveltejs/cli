/** @import { SvelteAst } from '../../../../tooling/index.js' */

import { createElement, appendElement, insertElement } from '../../../../tooling/html/index.js';

/** @param {SvelteAst.Fragment} ast */
export function run(ast) {
	const emptySpan = createElement('span');
	insertElement(ast, emptySpan);
	appendElement(ast, emptySpan);
}
