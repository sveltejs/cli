export {
	defineAdderConfig,
	defineAdderTests,
	defineAdder,
	defineAdderOptions
} from './adder/config.ts';
export { log } from '@svelte-cli/clack-prompts';
export { default as colors } from 'picocolors';
export { default as dedent } from 'dedent';

export type * from './files/processors.ts';
export type * from './adder/options.ts';
export type * from './adder/config.ts';

export { Walker, type AstTypes, type AstKinds } from '@svelte-cli/ast-tooling';
