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
export * as svelte from './core/tooling/svelte/index.ts';
export * as html from './core/tooling/html/index.ts';
import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './core/tooling/parsers.ts';
type Prettify<T> = {
	[K in keyof T]: T[K];
} & unknown;
/**
 * A `parser` for all supported languages.
 */
export const parse: Prettify<{
	css: typeof parseCss;
	html: typeof parseHtml;
	json: typeof parseJson;
	script: typeof parseScript;
	svelte: typeof parseSvelte;
	toml: typeof parseToml;
	yaml: typeof parseYaml;
}> = {
	css: parseCss,
	html: parseHtml,
	json: parseJson,
	script: parseScript,
	svelte: parseSvelte,
	toml: parseToml,
	yaml: parseYaml
};

// Types
export type * from './core/addon/processors.ts';
export type * from './core/addon/options.ts';
export type * from './core/addon/config.ts';
export type * from './core/addon/workspace.ts';
export type { Comments, AstTypes, SvelteAst } from './core/tooling/index.ts';
