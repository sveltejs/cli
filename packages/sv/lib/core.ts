export { log } from '@clack/prompts';
export { default as dedent } from 'dedent';

export { defineAddon, defineAddonOptions } from './core/addon/config.ts';
export { isVersionUnsupportedBelow, splitVersion } from './core/common.ts';

export { fileExists } from './cli/add/utils.ts';

export * as utils from './core/utils.ts';
export type * from './core/addon/processors.ts';
export type * from './core/addon/options.ts';
export type * from './core/addon/config.ts';
export type * from './core/addon/workspace.ts';

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
export const parse = {
	css: parseCss as typeof parseCss,
	html: parseHtml as typeof parseHtml,
	json: parseJson as typeof parseJson,
	script: parseScript as typeof parseScript,
	svelte: parseSvelte as typeof parseSvelte,
	toml: parseToml as typeof parseToml,
	yaml: parseYaml as typeof parseYaml
};

export { Walker } from './core/tooling/index.ts';
export type { Comments, AstTypes } from './core/tooling/index.ts';
export type { SvelteAst } from './core/tooling/svelte/index.ts';
export { resolveCommand } from 'package-manager-detector/commands';
export { getNodeTypesVersion, addToDemoPage, addEslintConfigPrettier } from './addons/common.ts';
export { getSharedFiles } from './create/utils.ts';
export { color } from './cli/add/utils.ts';
