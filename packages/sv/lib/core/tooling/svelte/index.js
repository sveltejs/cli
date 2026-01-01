import { parseScript } from '../index.ts';
import { parseSvelte } from '../parsers.ts';
import { appendFromString } from '../js/common.ts';

/** @typedef {import("../index.ts").SvelteAst.Root} Root */
/** @typedef {import("../index.ts").SvelteAst.Script} Script */

/** @typedef {Root & { instance: Script }} RootWithInstance */

/**
 * Ensures script instance exists. Because we create instance if it doesn't exist,
 * we can assert its presence for all further processing after calling this function.
 * @param {Root} ast
 * @param {{ langTs?: boolean }} [options]
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
		attributes: options?.langTs
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
 * @param {Root} ast
 * @param {{ svelteVersion: string; langTs?: boolean }} options
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

	ensureScript(ast, { langTs: options.langTs });
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
 * @param {Root} ast
 * @param {string} content
 * @param {{ mode?: 'append' | 'prepend' }} [options]
 */
export function addFragment(ast, content, options) {
	const { ast: fragmentAst } = parseSvelte(content);

	if (options?.mode === 'prepend') {
		ast.fragment.nodes.unshift(...fragmentAst.fragment.nodes);
	} else {
		ast.fragment.nodes.push(...fragmentAst.fragment.nodes);
	}
}
