export { log } from '@clack/prompts';
export { default as colors } from 'picocolors';
export { default as dedent } from 'dedent';

export { defineAddon, defineAddonOptions } from './core/addon/config.ts';
export { isVersionUnsupportedBelow, splitVersion } from './core/common.ts';
export * as utils from './core/utils.ts';

export type * from './core/addon/processors.ts';
export type * from './core/addon/options.ts';
export type * from './core/addon/config.ts';
export type * from './core/addon/workspace.ts';

export * as js from './core/tooling/js/index.ts';
export * as svelte from './core/tooling/svelte/index.ts';
export { parseSvelte } from './core/tooling/parsers.ts';
export { Walker } from './core/tooling/index.ts';
