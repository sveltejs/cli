/** @import { TomlTable } from 'smol-toml' */
/** @import { AstTypes, Comments, SvelteAst } from './index.js' */
import * as utils from './index.js';

/**
 * @typedef {{
 *   source: string;
 *   generateCode(): string;
 * }} ParseBase
 */

/**
 * @param {string} source
 * @returns {{ ast: AstTypes.Program; comments: Comments } & ParseBase}
 */
export function parseScript(source) {
	const { ast, comments } = utils.parseScript(source);
	const generateCode = () => utils.serializeScript(ast, comments, source);

	return { ast, comments, source, generateCode };
}

/**
 * @param {string} source
 * @returns {{ ast: SvelteAst.CSS.StyleSheet } & ParseBase}
 */
export function parseCss(source) {
	const ast = utils.parseCss(source);
	const generateCode = () => utils.serializeCss(ast);

	return { ast, source, generateCode };
}

/**
 * @param {string} source
 * @returns {{ ast: SvelteAst.Fragment } & ParseBase}
 */
export function parseHtml(source) {
	const ast = utils.parseHtml(source);
	const generateCode = () => utils.serializeHtml(ast);

	return { ast, source, generateCode };
}

/**
 * @param {string} source
 * @returns {{ data: any } & ParseBase}
 */
export function parseJson(source) {
	if (!source) source = '{}';
	const data = utils.parseJson(source);
	const generateCode = () => utils.serializeJson(source, data);

	return { data, source, generateCode };
}

/**
 * @param {string} source
 * @returns {{ data: ReturnType<typeof utils.parseYaml> } & ParseBase}
 */
export function parseYaml(source) {
	if (!source) source = '';
	const data = utils.parseYaml(source);
	const generateCode = () => utils.serializeYaml(data);

	return { data, source, generateCode };
}

/**
 * @param {string} source
 * @returns {{ ast: SvelteAst.Root } & ParseBase}
 */
export function parseSvelte(source) {
	const ast = utils.parseSvelte(source);

	const generateCode = () => utils.serializeSvelte(ast);

	return {
		ast,
		source,
		generateCode
	};
}

/**
 * @param {string} source
 * @returns {{ data: TomlTable } & ParseBase}
 */
export function parseToml(source) {
	const data = utils.parseToml(source);

	return {
		data,
		source,
		generateCode: () => utils.serializeToml(data)
	};
}
