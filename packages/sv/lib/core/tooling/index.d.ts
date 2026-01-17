import type { AST as SvelteAst } from 'svelte/compiler';
import type { TsEstree } from './js/ts-estree.d.ts';
import type { BaseNode } from 'estree';
import type { TomlTable } from 'smol-toml';
import type { parseDocument } from 'yaml';

export type { SvelteAst, TsEstree as AstTypes };

export type CommentType = { type: 'Line' | 'Block'; value: string };

export declare class Comments {
	constructor();
	add(node: BaseNode, comment: CommentType, options?: { position?: 'leading' | 'trailing' }): void;
	remove(predicate: (comment: TsEstree.Comment) => boolean | undefined | null): void;
	readonly original: SvelteAst.JSComment[];
	readonly leading: WeakMap<BaseNode, CommentType[]>;
	readonly trailing: WeakMap<BaseNode, CommentType[]>;
}

export declare function parseScript(content: string): {
	ast: TsEstree.Program;
	comments: Comments;
};

export declare function serializeScript(
	ast: TsEstree.Node,
	comments?: Comments,
	previousContent?: string
): string;

export declare function parseCss(content: string): SvelteAst.CSS.StyleSheet;

export declare function serializeCss(ast: SvelteAst.CSS.StyleSheet): string;

export declare function parseHtml(content: string): SvelteAst.Fragment;

export declare function serializeHtml(ast: SvelteAst.Fragment): string;

export declare function stripAst<T>(node: T, propsToRemove: string[]): T;

export declare function parseJson(content: string): any;

export declare function serializeJson(originalInput: string, data: unknown): string;

export declare function guessIndentString(str: string | undefined): string;

export declare function guessQuoteStyle(ast: TsEstree.Node): 'single' | 'double' | undefined;

export declare function parseYaml(content: string): ReturnType<typeof parseDocument>;

export declare function serializeYaml(data: ReturnType<typeof parseDocument>): string;

export declare function parseSvelte(content: string): SvelteAst.Root;

export declare function serializeSvelte(ast: SvelteAst.SvelteNode): string;

export declare function parseToml(content: string): TomlTable;

export declare function serializeToml(data: TomlTable): string;
