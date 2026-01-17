/** @import { TsEstree } from './js/ts-estree.d.ts' */
/** @import { BaseNode } from 'estree' */
/** @import { AST as SvelteAst } from 'svelte/compiler' */
import { print as esrapPrint } from 'esrap';
import ts from 'esrap/languages/ts';
import * as fleece from 'silver-fleece';
import { parse as svelteParse, print as sveltePrint } from 'svelte/compiler';
import * as yaml from 'yaml';
import * as toml from 'smol-toml';
import { ensureScript } from './svelte/index.js';

import { Walker } from '../../core.js';

// Type re-exports are in index.d.ts

/**
 * @param {string} content
 * @returns {{ ast: TsEstree.Program; comments: Comments }}
 */
export function parseScript(content) {
	const ast = parseSvelte(`<script lang="ts">${content}</script>`);
	ensureScript(ast);

	const comments = new Comments();
	const internal = transformToInternal(comments);
	internal.original.push(...ast.comments);

	return {
		ast: ast.instance.content,
		comments
	};
}

/**
 * @param {TsEstree.Node} ast
 * @param {Comments} [comments]
 * @param {string} [previousContent]
 * @returns {string}
 */
export function serializeScript(ast, comments, previousContent) {
	// we could theoretically use `printSvelte` here, but esrap gives us more control over the output
	// and `svelte` is using `esrap` under the hood anyway.

	const internal = transformToInternal(comments);
	const { code } = esrapPrint(
		// @ts-expect-error we are still using `estree` while `esrap` is using `@typescript-eslint/types`
		// which is causing these errors. But they are similar enough to work together.
		ast,
		ts({
			// @ts-expect-error see above
			comments: internal.original,
			getLeadingComments: (node) => internal.leading.get(node),
			getTrailingComments: (node) => internal.trailing.get(node),
			quotes: guessQuoteStyle(ast)
		}),
		{
			indent: guessIndentString(previousContent)
		}
	);
	return code;
}

/**
 * @param {string} content
 * @returns {SvelteAst.CSS.StyleSheet}
 */
export function parseCss(content) {
	const ast = parseSvelte(`<style>${content}</style>`);
	return /** @type {SvelteAst.CSS.StyleSheet} */ (ast.css);
}

/**
 * @param {SvelteAst.CSS.StyleSheet} ast
 * @returns {string}
 */
export function serializeCss(ast) {
	// `svelte` can print the stylesheet directly. But this adds the style tags (<style>) that we do not want here.
	// `svelte` is unable to print an array of rules (ast.children) directly, therefore we concatenate the printed rules manually.

	let result = '';

	for (let i = 0; i < ast.children.length; i++) {
		const child = ast.children[i];
		result += sveltePrint(child).code;

		if (i < ast.children.length - 1) {
			const next = ast.children[i + 1];

			if (child.type === 'Atrule' && next.type === 'Atrule') result += '\n';
			else result += '\n\n';
		}
	}

	return result;
}

/**
 * @param {string} content
 * @returns {SvelteAst.Fragment}
 */
export function parseHtml(content) {
	return parseSvelte(content).fragment;
}

/**
 * @param {SvelteAst.Fragment} ast
 * @returns {string}
 */
export function serializeHtml(ast) {
	return serializeSvelte(ast);
}

/**
 * @template T
 * @param {T} node
 * @param {string[]} propsToRemove
 * @returns {T}
 */
export function stripAst(node, propsToRemove) {
	if (typeof node !== 'object' || node === null) return node;

	// node traversal
	for (const key in node) {
		if (propsToRemove.includes(key)) {
			delete node[/** @type {keyof T} */ (key)];
			continue;
		}

		const child = node[key];
		if (child && typeof child === 'object') {
			if (Array.isArray(child)) {
				child.forEach((element) => stripAst(element, propsToRemove));
			} else {
				stripAst(child, propsToRemove);
			}
		}
	}

	return node;
}

/**
 * @param {string} content
 * @returns {any}
 */
export function parseJson(content) {
	// some of the files we need to process contain comments. The default
	// node JSON.parse fails parsing those comments.
	// use https://github.com/Rich-Harris/golden-fleece#fleecepatchstr-value instead

	return fleece.evaluate(content);
}

/**
 * @param {string} originalInput
 * @param {unknown} data
 * @returns {string}
 */
export function serializeJson(originalInput, data) {
	// some of the files we need to process contain comments. The default
	// node JSON.parse fails parsing those comments.
	const indentString = guessIndentString(originalInput);
	/** @type {number | undefined} */
	let spaces;

	// if indentString contains whitespaces, count them
	if (indentString && indentString.includes(' ')) spaces = (indentString.match(/ /g) || []).length;

	return fleece.stringify(data, { spaces });
}

// Sourced from `golden-fleece`
// https://github.com/Rich-Harris/golden-fleece/blob/f2446f331640f325e13609ed99b74b6a45e755c2/src/patch.ts#L302
/**
 * @param {string | undefined} str
 * @returns {string}
 */
export function guessIndentString(str) {
	if (!str) return '\t';

	const lines = str.split('\n');

	let tabs = 0;
	let spaces = 0;
	let minSpaces = 8;

	lines.forEach((line) => {
		const match = /^(?: +|\t+)/.exec(line);
		if (!match) return;

		const whitespace = match[0];
		if (whitespace.length === line.length) return;

		if (whitespace[0] === '\t') {
			tabs += 1;
		} else {
			spaces += 1;
			if (whitespace.length > 1 && whitespace.length < minSpaces) {
				minSpaces = whitespace.length;
			}
		}
	});

	if (spaces > tabs) {
		let result = '';
		while (minSpaces--) result += ' ';
		return result;
	} else {
		return '\t';
	}
}

/**
 * @param {TsEstree.Node} ast
 * @returns {'single' | 'double' | undefined}
 */
export function guessQuoteStyle(ast) {
	let singleCount = 0;
	let doubleCount = 0;

	Walker.walk(ast, null, {
		Literal(node) {
			if (node.raw && node.raw.length >= 2) {
				// we have at least two characters in the raw string that could represent both quotes
				const quotes = [node.raw[0], node.raw[node.raw.length - 1]];
				for (const quote of quotes) {
					switch (quote) {
						case "'":
							singleCount++;
							break;
						case '"':
							doubleCount++;
							break;
						default:
							break;
					}
				}
			}
		}
	});

	if (singleCount === 0 && doubleCount === 0) {
		// new file or file without any quotes
		return undefined;
	}

	return singleCount > doubleCount ? 'single' : 'double';
}

/**
 * @param {string} content
 * @returns {ReturnType<typeof yaml.parseDocument>}
 */
export function parseYaml(content) {
	return yaml.parseDocument(content);
}

/**
 * @param {ReturnType<typeof yaml.parseDocument>} data
 * @returns {string}
 */
export function serializeYaml(data) {
	return yaml.stringify(data, { singleQuote: true });
}

/** @typedef {{ type: 'Line' | 'Block'; value: string }} CommentType */

export class Comments {
	/** @type {SvelteAst.JSComment[]} */
	#original = [];
	/** @type {WeakMap<BaseNode, CommentType[]>} */
	#leading = new WeakMap();
	/** @type {WeakMap<BaseNode, CommentType[]>} */
	#trailing = new WeakMap();

	constructor() {
		this.#original = [];
		this.#leading = new WeakMap();
		this.#trailing = new WeakMap();
	}

	/**
	 * @param {BaseNode} node
	 * @param {CommentType} comment
	 * @param {{ position?: 'leading' | 'trailing' }} [options]
	 * @returns {void}
	 */
	add(node, comment, options) {
		const { position = 'leading' } = options ?? {};
		const map = position === 'leading' ? this.#leading : this.#trailing;
		const list = map.get(node) ?? [];
		// Let's not add 2 times the same comment to one node!
		if (!list.find((c) => c.value === comment.value)) {
			list.push(comment);
			map.set(node, list);
		}
	}

	/**
	 * @param {(comment: TsEstree.Comment) => boolean | undefined | null} predicate
	 * @returns {void}
	 */
	remove(predicate) {
		this.#original = this.#original.filter((c) => !predicate(c));
	}

	// Internal getters for transformToInternal
	get original() {
		return this.#original;
	}
	get leading() {
		return this.#leading;
	}
	get trailing() {
		return this.#trailing;
	}
}

/**
 * @typedef {{
 *   original: TsEstree.Comment[];
 *   leading: WeakMap<BaseNode, CommentType[]>;
 *   trailing: WeakMap<BaseNode, CommentType[]>;
 * }} CommentsInternal
 */

/**
 * @param {Comments | undefined} comments
 * @returns {CommentsInternal}
 */
function transformToInternal(comments) {
	const c = comments ?? new Comments();
	return {
		original: c.original,
		leading: c.leading,
		trailing: c.trailing
	};
}

/**
 * @param {string} content
 * @returns {SvelteAst.Root}
 */
export function parseSvelte(content) {
	return svelteParse(content, { modern: true });
}

/**
 * @param {SvelteAst.SvelteNode} ast
 * @returns {string}
 */
export function serializeSvelte(ast) {
	return sveltePrint(ast).code;
}

/**
 * @param {string} content
 * @returns {toml.TomlTable}
 */
export function parseToml(content) {
	return toml.parse(content);
}

/**
 * @param {toml.TomlTable} data
 * @returns {string}
 */
export function serializeToml(data) {
	return toml.stringify(data);
}
