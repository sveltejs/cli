import {
	defineAdderConfig,
	defineAdderTests,
	defineAdder,
	defineAdderOptions,
	defineAdderChecks
} from './adder/config';
import { executeCli } from './utils/cli';
import { log } from '@svelte-cli/clack-prompts';
import colors from 'picocolors';
import dedent from 'dedent';

export {
	defineAdderConfig,
	defineAdder,
	defineAdderTests,
	defineAdderOptions,
	defineAdderChecks,
	executeCli,
	dedent,
	log,
	colors
};

export type * from './files/processors';
export type * from './adder/execute';
export type * from './adder/options';
export type * from './adder/config';
