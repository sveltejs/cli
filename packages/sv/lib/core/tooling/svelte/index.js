/** @import { SvelteAst } from '../index.js' */
import { parseScript } from '../index.js';
import { parseSvelte } from '../parsers.js';
import { appendFromString } from '../js/common.js';

/**
 * @typedef {SvelteAst.Root & { instance: SvelteAst.Script }} RootWithInstance
 */

/**
 * Because we create instance if it doesn't exist, we can assert its presence
 * for all further processing after calling this function.
 * @param {SvelteAst.Root} ast
 * @param {{ language?: 'ts' | 'js' }} [options]
 * @returns {asserts ast is RootWithInstance}
 */
export function ensureScript(ast, options) {
	if (ast.instance?.content) return;

	ast.instance = {
		type: 'Script',
		start: 0,
		end: 0,
		context: 'default',
		// @ts-expect-error
		attributes:
			options?.language === 'ts'
				? [
						{
							type: 'Attribute',
							start: 8,
							end: 17,
							name: 'lang',
							value: [{ start: 14, end: 16, type: 'Text', raw: 'ts', data: 'ts' }]
						}
					]
				: [],
		content: parseScript('').ast
	};
}

/**
 * @param {SvelteAst.Root} ast
 * @param {{ svelteVersion: string; language?: 'ts' | 'js' }} options
 * @returns {void}
 */
export function addSlot(ast, options) {
	const slotSyntax =
		options.svelteVersion &&
		(options.svelteVersion.startsWith('4') || options.svelteVersion.startsWith('3'));

	if (slotSyntax) {
		// @ts-expect-error
		ast.fragment.nodes.push({
			type: 'SlotElement',
			attributes: [],
			fragment: {
				type: 'Fragment',
				nodes: []
			},
			name: 'slot',
			start: 0,
			end: 0
		});

		return;
	}

	ensureScript(ast, { language: options.language });
	appendFromString(ast.instance.content, {
		code: 'const { children } = $props();'
	});

	ast.fragment.nodes.push({
		type: 'RenderTag',
		expression: {
			type: 'CallExpression',
			callee: {
				type: 'Identifier',
				name: 'children',
				start: 0,
				end: 0
			},
			optional: false,
			arguments: []
		},
		start: 0,
		end: 0
	});
}

/**
 * @param {SvelteAst.Root} ast
 * @param {string} content
 * @param {{ mode?: 'append' | 'prepend' }} [options]
 * @returns {void}
 */
export function addFragment(ast, content, options) {
	const { ast: fragmentAst } = parseSvelte(content);

	if (options?.mode === 'prepend') {
		ast.fragment.nodes.unshift(...fragmentAst.fragment.nodes);
	} else {
		ast.fragment.nodes.push(...fragmentAst.fragment.nodes);
	}
}
