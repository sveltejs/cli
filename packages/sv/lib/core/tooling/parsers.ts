import type { TomlTable } from 'smol-toml';
import * as utils from './index.ts';

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
): { ast: Omit<utils.SvelteAst.CSS.StyleSheet, 'attributes' | 'content'> } & ParseBase {
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

export function parseYaml(
	source: string
): { data: ReturnType<typeof utils.parseYaml> } & ParseBase {
	if (!source) source = '';
	const data = utils.parseYaml(source);
	const generateCode = () => utils.serializeYaml(data);

	return { data, source, generateCode };
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
