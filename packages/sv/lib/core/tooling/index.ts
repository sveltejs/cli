import { print as esrapPrint } from 'esrap';
import ts from 'esrap/languages/ts';
import type { BaseNode } from 'estree';
import * as fleece from 'silver-fleece';
import { type AST as SvelteAst, parse as svelteParse, print as sveltePrint } from 'svelte/compiler';
import * as yaml from 'yaml';
import * as toml from 'smol-toml';
import { ensureScript } from './svelte/index.js';

import { Walker } from '../../core.ts';
import type { TsEstree } from './js/ts-estree.d.ts';

export type {
	// html
	SvelteAst,

	// js
	TsEstree as AstTypes
};

export function parseScript(content: string): {
	ast: TsEstree.Program;
	comments: Comments;
} {
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

export function serializeScript(
	ast: TsEstree.Node,
	comments?: Comments,
	previousContent?: string
): string {
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

export function parseCss(content: string): SvelteAst.CSS.StyleSheet {
	const ast = parseSvelte(`<style>${content}</style>`);
	return ast.css!;
}

export function serializeCss(ast: SvelteAst.CSS.StyleSheet): string {
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

export function parseHtml(content: string): SvelteAst.Fragment {
	return parseSvelte(content).fragment;
}

export function serializeHtml(ast: SvelteAst.Fragment): string {
	return serializeSvelte(ast);
}

export function stripAst<T>(node: T, propsToRemove: string[]): T {
	if (typeof node !== 'object' || node === null) return node;

	// node traversal
	for (const key in node) {
		if (propsToRemove.includes(key)) {
			delete node[key as keyof T];
			continue;
		}

		const child = node[key];
		if (child && typeof child === 'object') {
			if (Array.isArray(child)) {
				child.forEach((element) => stripAst<unknown>(element, propsToRemove));
			} else {
				stripAst(child, propsToRemove);
			}
		}
	}

	return node;
}

export function parseJson(content: string): any {
	// some of the files we need to process contain comments. The default
	// node JSON.parse fails parsing those comments.
	// use https://github.com/Rich-Harris/golden-fleece#fleecepatchstr-value instead

	return fleece.evaluate(content);
}

export function serializeJson(originalInput: string, data: unknown): string {
	// some of the files we need to process contain comments. The default
	// node JSON.parse fails parsing those comments.
	const indentString = guessIndentString(originalInput);
	let spaces: number | undefined;

	// if indentString contains whitespaces, count them
	if (indentString && indentString.includes(' ')) spaces = (indentString.match(/ /g) || []).length;

	return fleece.stringify(data, { spaces });
}

// Sourced from `golden-fleece`
// https://github.com/Rich-Harris/golden-fleece/blob/f2446f331640f325e13609ed99b74b6a45e755c2/src/patch.ts#L302
export function guessIndentString(str: string | undefined): string {
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

export function guessQuoteStyle(ast: TsEstree.Node): 'single' | 'double' | undefined {
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

export function parseYaml(content: string): ReturnType<typeof yaml.parseDocument> {
	return yaml.parseDocument(content);
}

export function serializeYaml(data: ReturnType<typeof yaml.parseDocument>): string {
	return yaml.stringify(data, { singleQuote: true });
}

export type CommentType = { type: 'Line' | 'Block'; value: string };

export class Comments {
	private original: SvelteAst.JSComment[];
	private leading: WeakMap<BaseNode, CommentType[]>;
	private trailing: WeakMap<BaseNode, CommentType[]>;

	constructor() {
		this.original = [];
		this.leading = new WeakMap();
		this.trailing = new WeakMap();
	}

	add(node: BaseNode, comment: CommentType, options?: { position?: 'leading' | 'trailing' }): void {
		const { position = 'leading' } = options ?? {};
		const map = position === 'leading' ? this.leading : this.trailing;
		const list = map.get(node) ?? [];
		// Let's not add 2 times the same comment to one node!
		if (!list.find((c) => c.value === comment.value)) {
			list.push(comment);
			map.set(node, list);
		}
	}

	remove(predicate: (comment: TsEstree.Comment) => boolean | undefined | null): void {
		this.original = this.original.filter((c) => !predicate(c));
	}
}

interface CommentsInternal {
	original: TsEstree.Comment[];
	leading: WeakMap<BaseNode, CommentType[]>;
	trailing: WeakMap<BaseNode, CommentType[]>;
}

function transformToInternal(comments: Comments | undefined): CommentsInternal {
	return (comments ?? new Comments()) as unknown as CommentsInternal;
}

export function parseSvelte(content: string): SvelteAst.Root {
	return svelteParse(content, { modern: true });
}

export function serializeSvelte(ast: SvelteAst.SvelteNode): string {
	return sveltePrint(ast).code;
}

export function parseToml(content: string): toml.TomlTable {
	return toml.parse(content);
}

export function serializeToml(data: toml.TomlTable): string {
	return toml.stringify(data);
}
