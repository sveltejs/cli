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
import * as Walker from 'zimmerframe';
import type { TsEstree } from './ts-estree.ts';
import { guessIndentString, guessQuoteStyle } from './utils.ts';
import { print as esrapPrint } from 'esrap';
import * as acorn from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';

/**
 * Most of the AST tooling is pretty big in bundle size and bundling takes forever.
 * Nevertheless bundling of these tools seems smart, as they add many dependencies to each install.
 * In order to avoid long bundling during development, all of the AST tools have been extracted
 * into this separate package and are bundled only here. This package has been marked as external
 * and will not be bundled into all other projects / bundles.
 */

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
 */
export function parseScript(content: string): TsEstree.Program {
	const comments: any[] = [];

	const acornTs = acorn.Parser.extend(tsPlugin({ allowSatisfies: true }));

	const ast = acornTs.parse(content, {
		ecmaVersion: 'latest',
		sourceType: 'module',
		locations: true,
		onComment: (block, value, start, end) => {
			if (block && /\n/.test(value)) {
				let a = start;
				while (a > 0 && content[a - 1] !== '\n') a -= 1;

				let b = a;
				while (/[ \t]/.test(content[b])) b += 1;

				const indentation = content.slice(a, b);
				value = value.replace(new RegExp(`^${indentation}`, 'gm'), '');
			}

			comments.push({ type: block ? 'Block' : 'Line', value, start, end });
		}
	});

	Walker.walk(ast, null, {
		_(node, { next }) {
			const commentNode /** @type {import('../../src/types').NodeWithComments} */ =
				/** @type {any} */ node;
			let comment;

			while (comments[0] && comments[0].start < node.start) {
				comment = comments.shift();
				// @ts-expect-error
				(commentNode.leadingComments ??= []).push(comment);
			}

			next();

			if (comments[0]) {
				const slice = content.slice(node.end, comments[0].start);

				if (/^[,) \t]*$/.test(slice)) {
					// @ts-expect-error
					commentNode.trailingComments = [comments.shift()];
				}
			}
		}
	});

	return ast as TsEstree.Program;
}

export function serializeScript(ast: TsEstree.Node, previousContent: string | undefined): string {
	const { code } = esrapPrint(ast, {
		indent: guessIndentString(previousContent),
		quotes: guessQuoteStyle(ast)
	});
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

export function stripAst<T>(node: T, propToRemove: string): T {
	if (typeof node !== 'object' || node === null) return node;
	if (propToRemove in node) delete node[propToRemove as keyof T];

	// node traversal
	for (const key in node) {
		const child = node[key];
		if (child && typeof child === 'object') {
			if (Array.isArray(child)) {
				child.forEach((element) => stripAst<unknown>(element, propToRemove));
			} else {
				stripAst(child, propToRemove);
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
	let spaces: undefined | number;

	// if indentString contains whitesepaces, count them
	if (indentString && indentString.includes(' ')) spaces = (indentString.match(/ /g) || []).length;

	return fleece.stringify(data, { spaces });
}
