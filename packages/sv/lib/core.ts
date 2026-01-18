// from externals
export { log } from '@clack/prompts';
export { default as dedent } from 'dedent';
export * as Walker from 'zimmerframe';

// from internals
export { defineAddon, defineAddonOptions } from './core/addon/config.ts';
export { color } from './cli/add/utils.ts';
// TODO JYC: move to utils all these bellow?
export { isVersionUnsupportedBelow } from './core/common.ts';
export { fileExists } from './cli/add/utils.ts';
export { resolveCommand } from 'package-manager-detector/commands';
export { getNodeTypesVersion, addToDemoPage } from './addons/common.ts';
// from internals, in utils
import { createPrinter } from './core/utils.ts';
export const utils = {
	createPrinter: createPrinter as typeof createPrinter
};

// parsing & languages
export * as css from './core/tooling/css/index.ts';
export * as js from './core/tooling/js/index.ts';
export * as html from './core/tooling/html/index.ts';
export * as svelte from './core/tooling/svelte/index.ts';
import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './core/tooling/parsers.ts';
/**
 * Will help you `parse` code into an `ast` from all supported languages.
 * Then manipulate the `ast` as you want,
 * and finally `generateCode()` to write it back to the file.
 *
 * ```ts
 * import { parse } from 'sv/core';
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

// Types
export type * from './core/addon/processors.ts';
export type * from './core/addon/options.ts';
export type * from './core/addon/config.ts';
export type * from './core/addon/workspace.ts';
export type { Comments, AstTypes, SvelteAst } from './core/tooling/index.ts';
