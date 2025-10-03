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
import * as acorn from 'acorn';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import * as yaml from 'yaml';

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
 * https://github.com/sveltejs/esrap/blob/9daf5dd43b31f17f596aa7da91678f2650666dd0/test/common.js#L12
 */
export function parseScript(content: string): TsEstree.Program {
	const comments: TsEstree.Comment[] = [];

	const acornTs = acorn.Parser.extend(tsPlugin());

	// Acorn doesn't add comments to the AST by itself. This factory returns the capabilities to add them after the fact.
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
	}) as TsEstree.Program;

	Walker.walk(ast as TsEstree.Node, null, {
		_(commentNode, { next }) {
			let comment: TsEstree.Comment;

			while (comments[0] && commentNode.start && comments[0].start! < commentNode.start) {
				comment = comments.shift()!;
				(commentNode.leadingComments ??= []).push(comment);
			}

			next();

			if (comments[0]) {
				const slice = content.slice(commentNode.end, comments[0].start);

				if (/^[,) \t]*$/.test(slice)) {
					commentNode.trailingComments = [comments.shift()!];
				}
			}
		}
	});

	return ast;
}

export function serializeScript(ast: TsEstree.Node, previousContent?: string): string {
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
