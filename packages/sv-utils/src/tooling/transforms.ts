import type { TomlTable } from 'smol-toml';
import type { Comments, SvelteAst } from './index.ts';
import type { TsEstree } from './js/ts-estree.ts';
import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './parsers.ts';

/**
 * Context injected by the `sv` engine when running a transform via `sv.file()`.
 * Can also be passed manually for standalone usage or testing.
 */
export type TransformContext = {
	language: 'ts' | 'js';
};

const TRANSFORM_KEY = '__transform' as const;

export type TransformType =
	| 'script'
	| 'css'
	| 'svelte'
	| 'json'
	| 'yaml'
	| 'toml'
	| 'text'
	| 'html';

export type TransformFn = {
	(content: string, ctx?: TransformContext): string;
	[TRANSFORM_KEY]: TransformType;
};

export function isTransform(
	fn: (content: string, ctx?: TransformContext) => string
): fn is TransformFn {
	return TRANSFORM_KEY in fn;
}

/**
 * File transform primitives that know their format.
 *
 * `sv-utils = what to do to content, sv = where and when to do it.`
 *
 * Each transform wraps: parse -> callback(ast/data) -> generateCode().
 * The parser choice is baked into the transform type — you can't accidentally
 * parse a vite config as svelte because you never call a parser yourself.
 *
 * @example
 * ```ts
 * import { transforms } from '@sveltejs/sv-utils';
 *
 * // returns a transform function (content: string) => string
 * const addPlugin = transforms.script((ast) => {
 *   js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
 * });
 *
 * // use with sv.file() — the engine injects context automatically
 * sv.file(files.viteConfig, transforms.script((ast) => {
 *   js.vite.addPlugin(ast, { code: 'kitRoutes()' });
 * }));
 *
 * // standalone usage / testing — pass context manually
 * const result = addPlugin(fileContent, { language: 'ts' });
 * ```
 */
export const transforms = {
	/**
	 * Transform a JavaScript/TypeScript file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	script(
		cb: (ast: TsEstree.Program, comments: Comments, ctx: TransformContext) => void | false
	): TransformFn {
		const fn = ((content: string, ctx?: TransformContext) => {
			const { ast, comments, generateCode } = parseScript(content);
			const result = cb(ast, comments, ctx ?? { language: 'ts' });
			if (result === false) return content;
			return generateCode();
		}) as TransformFn;
		fn[TRANSFORM_KEY] = 'script';
		return fn;
	},

	/**
	 * Transform a Svelte component file.
	 * Receives `language` from the engine context automatically.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	svelte(cb: (ast: SvelteAst.Root, ctx: TransformContext) => void | false): TransformFn {
		const fn = ((content: string, ctx?: TransformContext) => {
			const { ast, generateCode } = parseSvelte(content);
			const result = cb(ast, ctx ?? { language: 'ts' });
			if (result === false) return content;
			return generateCode();
		}) as TransformFn;
		fn[TRANSFORM_KEY] = 'svelte';
		return fn;
	},

	/**
	 * Transform a CSS file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	css(
		cb: (
			ast: Omit<SvelteAst.CSS.StyleSheetBase, 'attributes' | 'content'>,
			ctx: TransformContext
		) => void | false
	): TransformFn {
		const fn = ((content: string, ctx?: TransformContext) => {
			const { ast, generateCode } = parseCss(content);
			const result = cb(ast, ctx ?? { language: 'ts' });
			if (result === false) return content;
			return generateCode();
		}) as TransformFn;
		fn[TRANSFORM_KEY] = 'css';
		return fn;
	},

	/**
	 * Transform a JSON file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 *
	 * Pass `onParseError` to gracefully handle files that aren't valid JSON
	 * (e.g. `.prettierrc` which may be YAML).
	 */
	json<T = any>(
		cb: (data: T, ctx: TransformContext) => void | false,
		options?: { onParseError?: (error: unknown) => void }
	): TransformFn {
		const fn = ((content: string, ctx?: TransformContext) => {
			let parsed;
			try {
				parsed = parseJson(content);
			} catch (error) {
				if (options?.onParseError) {
					options.onParseError(error);
					return content;
				}
				throw error;
			}
			const result = cb(parsed.data as T, ctx ?? { language: 'ts' });
			if (result === false) return content;
			return parsed.generateCode();
		}) as TransformFn;
		fn[TRANSFORM_KEY] = 'json';
		return fn;
	},

	/**
	 * Transform a YAML file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	yaml(
		cb: (data: ReturnType<typeof parseYaml>['data'], ctx: TransformContext) => void | false
	): TransformFn {
		const fn = ((content: string, ctx?: TransformContext) => {
			const { data, generateCode } = parseYaml(content);
			const result = cb(data, ctx ?? { language: 'ts' });
			if (result === false) return content;
			return generateCode();
		}) as TransformFn;
		fn[TRANSFORM_KEY] = 'yaml';
		return fn;
	},

	/**
	 * Transform a TOML file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	toml(cb: (data: TomlTable, ctx: TransformContext) => void | false): TransformFn {
		const fn = ((content: string, ctx?: TransformContext) => {
			const { data, generateCode } = parseToml(content);
			const result = cb(data, ctx ?? { language: 'ts' });
			if (result === false) return content;
			return generateCode();
		}) as TransformFn;
		fn[TRANSFORM_KEY] = 'toml';
		return fn;
	},

	/**
	 * Transform an HTML file (e.g. app.html).
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	html(cb: (ast: SvelteAst.Fragment, ctx: TransformContext) => void | false): TransformFn {
		const fn = ((content: string, ctx?: TransformContext) => {
			const { ast, generateCode } = parseHtml(content);
			const result = cb(ast, ctx ?? { language: 'ts' });
			if (result === false) return content;
			return generateCode();
		}) as TransformFn;
		fn[TRANSFORM_KEY] = 'html';
		return fn;
	},

	/**
	 * Transform a plain text file (.env, .gitignore, etc.).
	 * No parsing — just string in, string out.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	text(cb: (content: string, ctx: TransformContext) => string | false): TransformFn {
		const fn = ((content: string, ctx?: TransformContext) => {
			const result = cb(content, ctx ?? { language: 'ts' });
			if (result === false) return content;
			return result;
		}) as TransformFn;
		fn[TRANSFORM_KEY] = 'text';
		return fn;
	}
};
