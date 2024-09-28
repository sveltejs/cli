import { execSync } from 'node:child_process';
import { exec } from 'tinyexec';
import { Command } from 'commander';
import { COMMANDS, constructCommand } from 'package-manager-detector';
import * as common from '../common.js';

export const migrate = new Command('migrate')
	.description('A CLI for migrating Svelte(Kit) codebases')
	.argument('<migration>', 'migration to run')
	.configureHelp({
		formatHelp() {
			// we'll pass the responsibility of presenting the help menu over to `svelte-migrate`
			execSync('npx svelte-migrate@latest --help', { stdio: 'inherit' });
			return '';
		}
	})
	.action(async (migration) => {
		const cwd = process.cwd();
		const pm = await common.guessPackageManager(cwd);
		const { command, args } = constructCommand(COMMANDS[pm].execute, [
			'svelte-migrate@latest',
			migration
		])!;

		await exec(command, args, { nodeOptions: { cwd, stdio: 'inherit' } });
	});
