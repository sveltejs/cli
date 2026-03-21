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
 *
 * When no context is provided (standalone usage), defaults to `{ language: 'js' }`.
 */
export type TransformContext = {
	language: 'ts' | 'js';
};

const DEFAULT_CONTEXT: TransformContext = { language: 'js' };

const TRANSFORM_KEY = '__transform' as const;

export type TransformFn = {
	(content: string, ctx?: TransformContext): string;
	[TRANSFORM_KEY]: true;
};

export function isTransform(
	fn: (content: string, ctx?: TransformContext) => string
): fn is TransformFn {
	return TRANSFORM_KEY in fn;
}

type TransformOptions = {
	/** Called when parsing fails. If provided, the original content is returned unchanged. */
	onParseError?: (error: unknown) => void;
};

function withParseError<T>(parseFn: () => T, options?: TransformOptions): T | undefined {
	try {
		return parseFn();
	} catch (error) {
		if (options?.onParseError) {
			options.onParseError(error);
			return undefined;
		}
		throw error;
	}
}

function brand(fn: (content: string, ctx?: TransformContext) => string): TransformFn {
	(fn as TransformFn)[TRANSFORM_KEY] = true;
	return fn as TransformFn;
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
		cb: (ast: TsEstree.Program, comments: Comments, ctx: TransformContext) => void | false,
		options?: TransformOptions
	): TransformFn {
		return brand((content: string, ctx?: TransformContext) => {
			const parsed = withParseError(() => parseScript(content), options);
			if (!parsed) return content;
			const result = cb(parsed.ast, parsed.comments, ctx ?? DEFAULT_CONTEXT);
			if (result === false) return content;
			return parsed.generateCode();
		});
	},

	/**
	 * Transform a Svelte component file.
	 * Receives `language` from the engine context automatically.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	svelte(
		cb: (ast: SvelteAst.Root, ctx: TransformContext) => void | false,
		options?: TransformOptions
	): TransformFn {
		return brand((content: string, ctx?: TransformContext) => {
			const parsed = withParseError(() => parseSvelte(content), options);
			if (!parsed) return content;
			const result = cb(parsed.ast, ctx ?? DEFAULT_CONTEXT);
			if (result === false) return content;
			return parsed.generateCode();
		});
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
		) => void | false,
		options?: TransformOptions
	): TransformFn {
		return brand((content: string, ctx?: TransformContext) => {
			const parsed = withParseError(() => parseCss(content), options);
			if (!parsed) return content;
			const result = cb(parsed.ast, ctx ?? DEFAULT_CONTEXT);
			if (result === false) return content;
			return parsed.generateCode();
		});
	},

	/**
	 * Transform a JSON file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	json<T = any>(
		cb: (data: T, ctx: TransformContext) => void | false,
		options?: TransformOptions
	): TransformFn {
		return brand((content: string, ctx?: TransformContext) => {
			const parsed = withParseError(() => parseJson(content), options);
			if (!parsed) return content;
			const result = cb(parsed.data as T, ctx ?? DEFAULT_CONTEXT);
			if (result === false) return content;
			return parsed.generateCode();
		});
	},

	/**
	 * Transform a YAML file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	yaml(
		cb: (data: ReturnType<typeof parseYaml>['data'], ctx: TransformContext) => void | false,
		options?: TransformOptions
	): TransformFn {
		return brand((content: string, ctx?: TransformContext) => {
			const parsed = withParseError(() => parseYaml(content), options);
			if (!parsed) return content;
			const result = cb(parsed.data, ctx ?? DEFAULT_CONTEXT);
			if (result === false) return content;
			return parsed.generateCode();
		});
	},

	/**
	 * Transform a TOML file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	toml(
		cb: (data: TomlTable, ctx: TransformContext) => void | false,
		options?: TransformOptions
	): TransformFn {
		return brand((content: string, ctx?: TransformContext) => {
			const parsed = withParseError(() => parseToml(content), options);
			if (!parsed) return content;
			const result = cb(parsed.data, ctx ?? DEFAULT_CONTEXT);
			if (result === false) return content;
			return parsed.generateCode();
		});
	},

	/**
	 * Transform an HTML file (e.g. app.html).
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	html(
		cb: (ast: SvelteAst.Fragment, ctx: TransformContext) => void | false,
		options?: TransformOptions
	): TransformFn {
		return brand((content: string, ctx?: TransformContext) => {
			const parsed = withParseError(() => parseHtml(content), options);
			if (!parsed) return content;
			const result = cb(parsed.ast, ctx ?? DEFAULT_CONTEXT);
			if (result === false) return content;
			return parsed.generateCode();
		});
	},

	/**
	 * Transform a plain text file (.env, .gitignore, etc.).
	 *
	 * Unlike other transforms there's no AST here — just string in, string out.
	 * Return the new content, or `false` to abort (original content is returned unchanged).
	 */
	text(cb: (content: string, ctx: TransformContext) => string | false): TransformFn {
		return brand((content: string, ctx?: TransformContext) => {
			const result = cb(content, ctx ?? DEFAULT_CONTEXT);
			if (result === false) return content;
			return result;
		});
	}
};
