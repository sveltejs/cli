import { Command } from 'commander';
import { doStuff } from '../migrate/index.ts';

export const migrate = new Command('migrate')
	.description('a CLI for migrating Svelte(Kit) codebases')
	.action(() => {
		doStuff();
	});
