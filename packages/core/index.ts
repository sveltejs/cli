export { defineAddon, defineAddonOptions } from './addon/config.ts';
export { log } from '@sveltejs/clack-prompts';
export { default as colors } from 'picocolors';
export { default as dedent } from 'dedent';
export * as utils from './utils.ts';

export type * from './addon/processors.ts';
export type * from './addon/options.ts';
export type * from './addon/config.ts';
export type * from './addon/workspace.ts';

export { Walker } from '@sveltejs/ast-tooling';
