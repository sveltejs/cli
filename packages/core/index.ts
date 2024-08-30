export {
	defineAdderConfig,
	defineAdderTests,
	defineAdder,
	defineAdderOptions,
	defineAdderChecks
} from './adder/config';
export { log } from '@svelte-cli/clack-prompts';
export { default as colors } from 'picocolors';
export { default as dedent } from 'dedent';

export type * from './files/processors';
export type * from './adder/options';
export type * from './adder/config';
