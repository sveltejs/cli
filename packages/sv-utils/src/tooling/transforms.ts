import type { TomlTable } from 'smol-toml';
import * as cssNs from './css/index.ts';
import * as htmlNs from './html/index.ts';
import type { Comments, SvelteAst } from './index.ts';
import * as jsNs from './js/index.ts';
import type { TsEstree } from './js/ts-estree.ts';
import * as jsonNs from './json.ts';
import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './parsers.ts';
import { type RootWithInstance, ensureScript } from './svelte/index.ts';
import * as svelteNs from './svelte/index.ts';
import * as textNs from './text.ts';

export type TransformFn = (content: string) => string;

type TransformOptions = {
	/** Called when parsing fails. If provided, the original content is returned unchanged. */
	onError?: (error: unknown) => void;
};

function withParseError<T>(parseFn: () => T, options?: TransformOptions): T | undefined {
	try {
		return parseFn();
	} catch (error) {
		if (options?.onError) {
			options.onError(error);
			return undefined;
		}
		throw error;
	}
}

/**
 * File transform primitives that know their format.
 *
 * `sv-utils = what to do to content, sv = where and when to do it.`
 *
 * Each transform wraps: parse -> callback({ast/data, utils}) -> generateCode().
 * The parser choice is baked into the transform type - you can't accidentally
 * parse a vite config as svelte because you never call a parser yourself.
 *
 * Transforms are curried: call with the callback to get a `(content: string) => string`
 * function that plugs directly into `sv.file()`.
 *
 * @example
 * ```ts
 * import { transforms } from '@sveltejs/sv-utils';
 *
 * // use with sv.file() - curried form plugs in directly
 * sv.file(files.viteConfig, transforms.script(({ ast, js }) => {
 *   js.vite.addPlugin(ast, { code: 'kitRoutes()' });
 * }));
 *
 * // standalone usage / testing
 * const result = transforms.script(({ ast, js }) => {
 *   js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
 * })(fileContent);
 * ```
 */
export const transforms = {
	/**
	 * Transform a JavaScript/TypeScript file.
	 *
	 * Return `false` from the callback to abort - the original content is returned unchanged.
	 */
	script(
		cb: (file: {
			ast: TsEstree.Program;
			comments: Comments;
			content: string;
			js: typeof jsNs;
		}) => void | false,
		options?: TransformOptions
	): (content: string) => string {
		return (content) => {
			const parsed = withParseError(() => parseScript(content), options);
			if (!parsed) return content;
			const result = cb({ ast: parsed.ast, comments: parsed.comments, content, js: jsNs });
			if (result === false) return content;
			return parsed.generateCode();
		};
	},

	/**
	 * Transform a Svelte component file.
	 *
	 * Return `false` from the callback to abort - the original content is returned unchanged.
	 */
	svelte(
		cb: (file: {
			ast: SvelteAst.Root;
			content: string;
			svelte: typeof svelteNs;
			js: typeof jsNs;
		}) => void | false,
		options?: TransformOptions
	): (content: string) => string {
		return (content) => {
			const parsed = withParseError(() => parseSvelte(content), options);
			if (!parsed) return content;
			const result = cb({ ast: parsed.ast, content, svelte: svelteNs, js: jsNs });
			if (result === false) return content;
			return parsed.generateCode();
		};
	},

	/**
	 * Transform a Svelte component file with a script block guaranteed.
	 *
	 * Calls `ensureScript` before invoking your callback, so `ast.instance` is always non-null.
	 * Pass `{ language }` as the first argument to set the script language.
	 *
	 * Return `false` from the callback to abort - the original content is returned unchanged.
	 */
	svelteScript(
		scriptOptions: { language: 'ts' | 'js' },
		cb: (file: {
			ast: RootWithInstance;
			content: string;
			svelte: typeof svelteNs;
			js: typeof jsNs;
		}) => void | false,
		options?: TransformOptions
	): TransformFn {
		return (content) => {
			const parsed = withParseError(() => parseSvelte(content), options);
			if (!parsed) return content;
			ensureScript(parsed.ast, scriptOptions);
			const result = cb({
				ast: parsed.ast as RootWithInstance,
				content,
				svelte: svelteNs,
				js: jsNs
			});
			if (result === false) return content;
			return parsed.generateCode();
		};
	},

	/**
	 * Transform a CSS file.
	 *
	 * Return `false` from the callback to abort - the original content is returned unchanged.
	 */
	css(
		cb: (file: {
			ast: Omit<SvelteAst.CSS.StyleSheetBase, 'attributes' | 'content'>;
			content: string;
			css: typeof cssNs;
		}) => void | false,
		options?: TransformOptions
	): TransformFn {
		return (content) => {
			const parsed = withParseError(() => parseCss(content), options);
			if (!parsed) return content;
			const result = cb({ ast: parsed.ast, content, css: cssNs });
			if (result === false) return content;
			return parsed.generateCode();
		};
	},

	/**
	 * Transform a JSON file.
	 *
	 * Return `false` from the callback to abort - the original content is returned unchanged.
	 */
	json<T = any>(
		cb: (file: { data: T; content: string; json: typeof jsonNs }) => void | false,
		options?: TransformOptions
	): TransformFn {
		return (content) => {
			const parsed = withParseError(() => parseJson(content), options);
			if (!parsed) return content;
			const result = cb({ data: parsed.data as T, content, json: jsonNs });
			if (result === false) return content;
			return parsed.generateCode();
		};
	},

	/**
	 * Transform a YAML file.
	 *
	 * Return `false` from the callback to abort - the original content is returned unchanged.
	 */
	yaml(
		cb: (file: { data: ReturnType<typeof parseYaml>['data']; content: string }) => void | false,
		options?: TransformOptions
	): TransformFn {
		return (content) => {
			const parsed = withParseError(() => parseYaml(content), options);
			if (!parsed) return content;
			const result = cb({ data: parsed.data, content });
			if (result === false) return content;
			return parsed.generateCode();
		};
	},

	/**
	 * Transform a TOML file.
	 *
	 * Return `false` from the callback to abort - the original content is returned unchanged.
	 */
	toml(
		cb: (file: { data: TomlTable; content: string }) => void | false,
		options?: TransformOptions
	): TransformFn {
		return (content) => {
			const parsed = withParseError(() => parseToml(content), options);
			if (!parsed) return content;
			const result = cb({ data: parsed.data, content });
			if (result === false) return content;
			return parsed.generateCode();
		};
	},

	/**
	 * Transform an HTML file (e.g. app.html).
	 *
	 * Return `false` from the callback to abort - the original content is returned unchanged.
	 */
	html(
		cb: (file: { ast: SvelteAst.Fragment; content: string; html: typeof htmlNs }) => void | false,
		options?: TransformOptions
	): TransformFn {
		return (content) => {
			const parsed = withParseError(() => parseHtml(content), options);
			if (!parsed) return content;
			const result = cb({ ast: parsed.ast, content, html: htmlNs });
			if (result === false) return content;
			return parsed.generateCode();
		};
	},

	/**
	 * Transform a plain text file (.env, .gitignore, etc.).
	 *
	 * Unlike other transforms there's no AST here - just string in, string out.
	 * Return the new content, or `false` to abort (original content is returned unchanged).
	 */
	text(cb: (file: { content: string; text: typeof textNs }) => string | false): TransformFn {
		return (content) => {
			const result = cb({ content, text: textNs });
			if (result === false) return content;
			return result;
		};
	}
};
