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
	const generateCode = () => utils.serializeHtml(ast);

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
	const ast = utils.parseSvelte(source);

	const generateCode = () => utils.serializeSvelte(ast);

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
