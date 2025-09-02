export { defineAddon, defineAddonOptions, prepareAddonOptions } from './addon/config.ts';
export { log } from '@clack/prompts';
export { default as colors } from 'picocolors';
export { default as dedent } from 'dedent';
export * as utils from './utils.ts';
export { isVersionUnsupportedBelow, splitVersion } from './common.ts';

export type * from './addon/processors.ts';
export type * from './addon/options.ts';
export type * from './addon/config.ts';
export type * from './addon/workspace.ts';

export { Walker } from './tooling/index.ts';
