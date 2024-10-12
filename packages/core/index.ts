export { defineAdderTests, defineAdder, defineAdderOptions } from './adder/config.ts';
export { log } from '@sveltejs/clack-prompts';
export { default as colors } from 'picocolors';
export { default as dedent } from 'dedent';
export * as utils from './utils.ts';

export type * from './adder/processors.ts';
export type * from './adder/options.ts';
export type * from './adder/config.ts';
export type * from './adder/workspace.ts';

export { Walker } from '@sveltejs/ast-tooling';
