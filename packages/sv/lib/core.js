// from externals
export { log } from '@clack/prompts';
export { default as dedent } from 'dedent';
export * as Walker from 'zimmerframe';

// from internals
export { defineAddon, defineAddonOptions } from './core/addon/config.js';
export { color } from './cli/add/utils.js';
// TODO JYC: move to utils all these bellow?
export { isVersionUnsupportedBelow } from './core/common.js';
export { fileExists } from './cli/add/utils.js';
export { resolveCommand } from 'package-manager-detector/commands';
export { getNodeTypesVersion, addToDemoPage } from './addons/common.js';
// from internals, in utils
import { createPrinter } from './core/utils.js';
export const utils = {
	createPrinter
};

// parsing & languages
export * as css from './core/tooling/css/index.js';
export * as js from './core/tooling/js/index.js';
export * as html from './core/tooling/html/index.js';
import { ensureScript, addSlot, addFragment } from './core/tooling/svelte/index.js';
/**
 * Helper functions to manipulate Svelte code.
 */
export const svelte = {
	ensureScript,
	addSlot,
	addFragment
};
import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './core/tooling/parsers.js';
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
	css: parseCss,
	html: parseHtml,
	json: parseJson,
	script: parseScript,
	svelte: parseSvelte,
	toml: parseToml,
	yaml: parseYaml
};
