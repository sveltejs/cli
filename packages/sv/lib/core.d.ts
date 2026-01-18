// Runtime exports
export { log } from '@clack/prompts';
export { default as dedent } from 'dedent';
export * as Walker from 'zimmerframe';
export { defineAddon, defineAddonOptions } from './core/addon/config.js';
export { color } from './cli/add/utils.js';
export { isVersionUnsupportedBelow } from './core/common.js';
export { fileExists } from './cli/add/utils.js';
export { resolveCommand } from 'package-manager-detector/commands';
export { getNodeTypesVersion, addToDemoPage } from './addons/common.js';
export { createPrinter } from './core/utils.js';
export * as css from './core/tooling/css/index.js';
export * as js from './core/tooling/js/index.js';
export * as html from './core/tooling/html/index.js';

import { ensureScript, addSlot, addFragment } from './core/tooling/svelte/index.js';
import {
	parseCss,
	parseHtml,
	parseJson,
	parseScript,
	parseSvelte,
	parseToml,
	parseYaml
} from './core/tooling/parsers.js';

export declare const utils: {
	createPrinter: typeof import('./core/utils.js').createPrinter;
};

export declare const svelte: {
	ensureScript: typeof ensureScript;
	addSlot: typeof addSlot;
	addFragment: typeof addFragment;
};

/** hello! */
export declare const parse: {
	css: typeof parseCss;
	html: typeof parseHtml;
	json: typeof parseJson;
	script: typeof parseScript;
	svelte: typeof parseSvelte;
	toml: typeof parseToml;
	yaml: typeof parseYaml;
};

// Type exports
export type * from './core/addon/types.d.ts';
export type { Comments, AstTypes, SvelteAst } from './core/tooling/index.js';
