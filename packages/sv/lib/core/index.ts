export { defineAddon, defineAddonOptions } from './addon/config.ts';
export { log } from '@clack/prompts';
export { default as colors } from 'picocolors';
export { default as dedent } from 'dedent';
export * as utils from './utils.ts';
export { isVersionUnsupportedBelow, splitVersion } from './common.ts';

export type * from './addon/processors.ts';
export type * from './addon/options.ts';
export type * from './addon/config.ts';
export type * from './addon/workspace.ts';
import { arrayUpsert, packageScriptsUpsert } from './tooling/json.ts';
export const json: {
	arrayUpsert: typeof arrayUpsert;
	packageScriptsUpsert: typeof packageScriptsUpsert;
} = {
	arrayUpsert,
	packageScriptsUpsert
};

export { Walker } from './tooling/index.ts';
export * as js from './tooling/js/index.ts';
export * as svelte from './tooling/svelte/index.ts';
export { parseSvelte } from './tooling/parsers.ts';
