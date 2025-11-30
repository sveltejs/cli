import * as Walker from 'zimmerframe';
import type { TsEstree } from './js/ts-estree.ts';
import { Document, Element, type ChildNode } from 'domhandler';
import { ElementType, parseDocument } from 'htmlparser2';
import serializeDom from 'dom-serializer';
import {
	Root as CssAst,
	Declaration,
	Rule,
	AtRule,
	Comment,
	parse as postcssParse,
	type ChildNode as CssChildNode
} from 'postcss';
import * as fleece from 'silver-fleece';
import { print as esrapPrint } from 'esrap';
import ts from 'esrap/languages/ts';
import * as acorn from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import * as yaml from 'yaml';

export type CommentType = { type: 'Line' | 'Block'; value: string };

export class CommentState {
	comments: Comments;
	leading: WeakMap<TsEstree.Node, CommentType[]>;
	trailing: WeakMap<TsEstree.Node, CommentType[]>;

	constructor() {
		this.leading = new WeakMap();
		this.trailing = new WeakMap();
		this.comments = new Comments([], this.leading, this.trailing);
	}
}

/**
 * A helper class for managing comments that should be added to AST nodes during code generation.
 * Provides methods to add leading comments (before a node) and trailing comments (after a node).
 */
export class Comments {
	/** The original comments parsed from source code */
	original: TsEstree.Comment[];
	#leading: WeakMap<TsEstree.Node, CommentType[]>;
	#trailing: WeakMap<TsEstree.Node, CommentType[]>;

	constructor(
		original: TsEstree.Comment[],
		leading: WeakMap<TsEstree.Node, CommentType[]>,
		trailing: WeakMap<TsEstree.Node, CommentType[]>
	) {
		this.original = original;
		this.#leading = leading;
		this.#trailing = trailing;
	}

	/** Add a comment that will appear before the given node */
	addLeading(node: TsEstree.Node, comment: CommentType): void {
		const list = this.#leading.get(node) ?? [];
		list.push(comment);
		this.#leading.set(node, list);
	}

	/** Add a comment that will appear after the given node */
	addTrailing(node: TsEstree.Node, comment: CommentType): void {
		const list = this.#trailing.get(node) ?? [];
		list.push(comment);
		this.#trailing.set(node, list);
	}
}

export {
	// html
	Document as HtmlDocument,
	Element as HtmlElement,
	ElementType as HtmlElementType,

	// css
	CssAst,
	Declaration,
	Rule,
	AtRule,
	Comment,

	// ast walker
	Walker
};

export type {
	// html
	ChildNode as HtmlChildNode,

	// js
	TsEstree as AstTypes,

	//css
	CssChildNode
};

/**
 * Parses as string to an AST. Code below is taken from `esrap` to ensure compatibilty.
 * https://github.com/sveltejs/esrap/blob/920491535d31484ac5fae2327c7826839d851aed/test/common.js#L14
 */
export function parseScript(
	content: string,
	commentState?: CommentState
): {
	ast: TsEstree.Program;
	comments: Comments;
} {
	const acornTs = acorn.Parser.extend(tsPlugin());
	commentState ??= new CommentState();

	const ast = acornTs.parse(content, {
		ecmaVersion: 'latest',
		sourceType: 'module',
		locations: true,
		onComment: (block, value, start, end, startLoc, endLoc) => {
			if (block && /\n/.test(value)) {
				let a = start;
				while (a > 0 && content[a - 1] !== '\n') a -= 1;

				let b = a;
				while (/[ \t]/.test(content[b])) b += 1;

				const indentation = content.slice(a, b);
				value = value.replace(new RegExp(`^${indentation}`, 'gm'), '');
			}

			commentState.comments.original.push({
				type: block ? 'Block' : 'Line',
				value,
				start,
				end,
				loc: { start: startLoc as TsEstree.Position, end: endLoc as TsEstree.Position }
			});
		}
	}) as TsEstree.Program;

	return {
		ast,
		comments: commentState.comments
	};
}

export function serializeScript(
	ast: TsEstree.Node,
	commentState?: CommentState,
	previousContent?: string
): string {
	const { code } = esrapPrint(
		// @ts-expect-error we are still using `estree` while `esrap` is using `@typescript-eslint/types`
		// which is causing these errors. But they are simmilar enough to work together.
		ast,
		ts({
			// @ts-expect-error see above
			comments: commentState?.comments.original,
			// @ts-expect-error see above
			getLeadingComments: (node) => commentState?.leading.get(node),
			// @ts-expect-error see above
			getTrailingComments: (node) => commentState?.trailing.get(node)
		}),
		{
			indent: guessIndentString(previousContent)
		}
	);
	return code;
}

export function parseCss(content: string): CssAst {
	return postcssParse(content);
}

export function serializeCss(ast: CssAst): string {
	return ast.toString();
}

export function parseHtml(content: string): Document {
	return parseDocument(content, {
		recognizeSelfClosing: true,
		lowerCaseTags: false
	});
}

export function serializeHtml(ast: Document): string {
	return serializeDom(ast, { encodeEntities: 'utf8', selfClosingTags: true });
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

export function parseYaml(content: string): ReturnType<typeof yaml.parseDocument> {
	return yaml.parseDocument(content);
}

export function serializeYaml(data: ReturnType<typeof yaml.parseDocument>): string {
	return yaml.stringify(data, { singleQuote: true });
}
