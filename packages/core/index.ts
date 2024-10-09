export {
	defineAdderConfig,
	defineAdderTests,
	defineAdder,
	defineAdderOptions,
	defineAdderChecks
} from './adder/config.ts';
export { log } from '@svelte-cli/clack-prompts';
export { default as colors } from 'picocolors';
export { default as dedent } from 'dedent';

export type * from './adder/processors.ts';
export type * from './adder/options.ts';
export type * from './adder/config.ts';
export type * from './adder/workspace.ts';

export { Walker } from '@svelte-cli/ast-tooling';
