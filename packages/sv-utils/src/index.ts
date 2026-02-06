// External re-exports
export { log } from '@clack/prompts';
export { default as dedent } from 'dedent';
export * as Walker from 'zimmerframe';
export { resolveCommand } from 'package-manager-detector/commands';

// Parsing & language namespaces
export * as css from './tooling/css/index.ts';
export * as js from './tooling/js/index.ts';
export * as html from './tooling/html/index.ts';
export * as text from './tooling/text.ts';
export * as json from './tooling/json.ts';
export * as svelte from './tooling/svelte/index.ts';

import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './tooling/parsers.ts';
/**
 * Will help you `parse` code into an `ast` from all supported languages.
 * Then manipulate the `ast` as you want,
 * and finally `generateCode()` to write it back to the file.
 *
 * ```ts
 * import { parse } from '@sveltejs/sv-utils';
 *
 * const { ast, generateCode } = parse.css('body { color: red; }');
 * const { ast, generateCode } = parse.html('<div>Hello, world!</div>');
 * const { ast, generateCode } = parse.json('{ "name": "John", "age": 30 }');
 * const { ast, generateCode } = parse.script('function add(a, b) { return a + b; }');
 * const { ast, generateCode } = parse.svelte('<div>Hello, world!</div>');
 * const { ast, generateCode } = parse.toml('name = "John"');
 * const { ast, generateCode } = parse.yaml('name: John');
 * ```
 */
export const parse = {
	css: parseCss as typeof parseCss,
	html: parseHtml as typeof parseHtml,
	json: parseJson as typeof parseJson,
	script: parseScript as typeof parseScript,
	svelte: parseSvelte as typeof parseSvelte,
	toml: parseToml as typeof parseToml,
	yaml: parseYaml as typeof parseYaml
};

// Utilities
export { splitVersion, isVersionUnsupportedBelow } from './common.ts';
export { createPrinter } from './utils.ts';
export { sanitizeName } from './sanitize.ts';
export { downloadJson } from './downloadJson.ts';

// Types
export type { Comments, AstTypes, SvelteAst } from './tooling/index.ts';
