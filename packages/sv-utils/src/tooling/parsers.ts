import type { TomlTable } from 'smol-toml';
import * as utils from './index.ts';

/**
 * Minimal shape for YAML document roots from `parse.yaml` — avoids re-exporting the full `yaml` types.
 * At runtime this is the library’s document type; only `get` / `set` are part of the public contract.
 */
export type YamlDocument = {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
};

type ParseBase = {
	source: string;
	/**
	 * Generate the code after manipulating the `ast`.
	 *
	 * ```ts
	 * import { svelte } from 'sv/core';
	 * const { ast, generateCode } = parse.svelte(content);
	 *
	 * svelte.addFragment(ast, '<p>Hello World</p>');
	 *
	 * const code = generateCode();
	 * ```
	 */
	generateCode(): string;
};

const STYLE_TAG_REGEX = /(<style\b([^>]*)>)([\s\S]*?)<\/style\s*>/gi;
const LANG_ATTRIBUTE_REGEX = /(?:^|\s)lang(?:\s|=|$)/;

export function parseScript(source: string): {
	ast: utils.AstTypes.Program;
	comments: utils.Comments;
} & ParseBase {
	const { ast, comments } = utils.parseScript(source);
	const generateCode = () => utils.serializeScript(ast, comments, source);

	return { ast, comments, source, generateCode };
}

export function parseCss(
	source: string
): { ast: Omit<utils.SvelteAst.CSS.StyleSheetBase, 'attributes' | 'content'> } & ParseBase {
	const ast = utils.parseCss(source);
	const generateCode = () => utils.serializeCss(ast);

	return { ast, source, generateCode };
}

export function parseHtml(source: string): { ast: utils.SvelteAst.Fragment } & ParseBase {
	const ast = utils.parseHtml(source);
	const generateCode = () => utils.serializeHtml(ast, source);

	return { ast, source, generateCode };
}

export function parseJson(source: string): { data: any } & ParseBase {
	if (!source) source = '{}';
	const data = utils.parseJson(source);
	const generateCode = () => utils.serializeJson(source, data);

	return { data, source, generateCode };
}

export function parseYaml(source: string): { data: YamlDocument } & ParseBase {
	if (!source) source = '';
	const data = utils.parseYaml(source);
	const generateCode = () => utils.serializeYaml(data as Parameters<typeof utils.serializeYaml>[0]);

	return { data: data as YamlDocument, source, generateCode };
}

export function parseSvelte(source: string): { ast: utils.SvelteAst.Root } & ParseBase {
	// Handle `<style lang="...">` blocks by replacing them with a safe placeholder,
	// so that the Svelte parser doesn't throw errors on unknown languages.
	const styles: string[] = [];
	const sourceWithSafeStyles = source.replace(
		STYLE_TAG_REGEX,
		(match, openingTag: string, attributes: string, content: string) => {
			if (!LANG_ATTRIBUTE_REGEX.test(attributes)) return match;

			styles.push(content);
			return `${openingTag}/* */</style>`;
		}
	);
	const ast = utils.parseSvelte(sourceWithSafeStyles);

	const generateCode = () => {
		let code = utils.serializeSvelte(ast, source);
		let styleIndex = 0;
		code = code.replace(STYLE_TAG_REGEX, (match, openingTag: string, attributes: string) => {
			if (!LANG_ATTRIBUTE_REGEX.test(attributes) || styleIndex === styles.length) return match;
			return `${openingTag}${styles[styleIndex++]}</style>`;
		});

		return code;
	};

	return {
		ast,
		source,
		generateCode
	};
}

export function parseToml(source: string): { data: TomlTable } & ParseBase {
	const data = utils.parseToml(source);

	return {
		data,
		source,
		generateCode: () => utils.serializeToml(data)
	};
}
