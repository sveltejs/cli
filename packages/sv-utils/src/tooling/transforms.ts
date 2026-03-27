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
 * import { transforms, js } from '@sveltejs/sv-utils';
 *
 * // use with sv.file() — content flows through naturally
 * sv.file(files.viteConfig, (content) => {
 *   return transforms.script(content, (ast) => {
 *     js.vite.addPlugin(ast, { code: 'kitRoutes()' });
 *   });
 * });
 *
 * // standalone usage / testing
 * const result = transforms.script(fileContent, (ast) => {
 *   js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
 * });
 * ```
 */
export const transforms = {
	/**
	 * Transform a JavaScript/TypeScript file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	script(
		content: string,
		cb: (ast: TsEstree.Program, comments: Comments) => void | false,
		options?: TransformOptions
	): string {
		const parsed = withParseError(() => parseScript(content), options);
		if (!parsed) return content;
		const result = cb(parsed.ast, parsed.comments);
		if (result === false) return content;
		return parsed.generateCode();
	},

	/**
	 * Transform a Svelte component file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	svelte(
		content: string,
		cb: (ast: SvelteAst.Root) => void | false,
		options?: TransformOptions
	): string {
		const parsed = withParseError(() => parseSvelte(content), options);
		if (!parsed) return content;
		const result = cb(parsed.ast);
		if (result === false) return content;
		return parsed.generateCode();
	},

	/**
	 * Transform a CSS file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	css(
		content: string,
		cb: (ast: Omit<SvelteAst.CSS.StyleSheetBase, 'attributes' | 'content'>) => void | false,
		options?: TransformOptions
	): string {
		const parsed = withParseError(() => parseCss(content), options);
		if (!parsed) return content;
		const result = cb(parsed.ast);
		if (result === false) return content;
		return parsed.generateCode();
	},

	/**
	 * Transform a JSON file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	json<T = any>(
		content: string,
		cb: (data: T) => void | false,
		options?: TransformOptions
	): string {
		const parsed = withParseError(() => parseJson(content), options);
		if (!parsed) return content;
		const result = cb(parsed.data as T);
		if (result === false) return content;
		return parsed.generateCode();
	},

	/**
	 * Transform a YAML file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	yaml(
		content: string,
		cb: (data: ReturnType<typeof parseYaml>['data']) => void | false,
		options?: TransformOptions
	): string {
		const parsed = withParseError(() => parseYaml(content), options);
		if (!parsed) return content;
		const result = cb(parsed.data);
		if (result === false) return content;
		return parsed.generateCode();
	},

	/**
	 * Transform a TOML file.
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	toml(content: string, cb: (data: TomlTable) => void | false, options?: TransformOptions): string {
		const parsed = withParseError(() => parseToml(content), options);
		if (!parsed) return content;
		const result = cb(parsed.data);
		if (result === false) return content;
		return parsed.generateCode();
	},

	/**
	 * Transform an HTML file (e.g. app.html).
	 *
	 * Return `false` from the callback to abort — the original content is returned unchanged.
	 */
	html(
		content: string,
		cb: (ast: SvelteAst.Fragment) => void | false,
		options?: TransformOptions
	): string {
		const parsed = withParseError(() => parseHtml(content), options);
		if (!parsed) return content;
		const result = cb(parsed.ast);
		if (result === false) return content;
		return parsed.generateCode();
	},

	/**
	 * Transform a plain text file (.env, .gitignore, etc.).
	 *
	 * Unlike other transforms there's no AST here — just string in, string out.
	 * Return the new content, or `false` to abort (original content is returned unchanged).
	 */
	text(content: string, cb: (content: string) => string | false): string {
		const result = cb(content);
		if (result === false) return content;
		return result;
	}
};
