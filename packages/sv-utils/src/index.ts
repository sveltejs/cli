import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './tooling/parsers.ts';

// External re-exports
export { default as dedent } from 'dedent';
export * as Walker from 'zimmerframe';
export {
	AGENTS,
	type AgentName,
	COMMANDS,
	constructCommand,
	detect,
	resolveCommand
} from 'package-manager-detector';

// Parsing & language namespaces
export * as css from './tooling/css/index.ts';
export * as js from './tooling/js/index.ts';
export * as html from './tooling/html/index.ts';
export * as text from './tooling/text.ts';
export * as json from './tooling/json.ts';
export * as svelte from './tooling/svelte/index.ts';

// Transforms — sv-utils = what to do to content, sv = where and when to do it.
export {
	transforms,
	isTransform,
	type TransformFn,
	type TransformContext
} from './tooling/transforms.ts';

/**
 * Low-level parsers. Prefer `transforms` for add-on file edits — it picks the
 * right parser for you and handles `generateCode()` automatically.
 *
 * Use `parse` directly when you need error handling around parsing or
 * conditional parser selection at runtime.
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
	css: parseCss,
	html: parseHtml,
	json: parseJson,
	script: parseScript,
	svelte: parseSvelte,
	toml: parseToml,
	yaml: parseYaml
};

// Utilities
export { splitVersion, isVersionUnsupportedBelow } from './common.ts';
export { createPrinter } from './utils.ts';
export { sanitizeName } from './sanitize.ts';
export { downloadJson } from './downloadJson.ts';

// Terminal styling
export { color } from './color.ts';

// Types
export type { Comments, AstTypes, SvelteAst } from './tooling/index.ts';
