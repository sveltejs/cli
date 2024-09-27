import { Argument, Command } from 'commander';
import * as common from '../common.js';
import { COMMANDS, constructCommand, detect } from 'package-manager-detector';
import { exec } from 'tinyexec';

// TODO: `svelte-5` migration is still unreleased: https://github.com/sveltejs/kit/pull/12519
const migrationChoices = ['sveltekit-2', 'svelte-4', 'svelte-5', 'package', 'routes'];
const migrationOption = new Argument('<migration>', 'migration to run').choices(migrationChoices);

export const migrate = new Command('migrate')
	.description('A CLI for migrating Svelte(Kit) codebases.')
	.addArgument(migrationOption)
	.configureHelp(common.helpConfig)
	.action((migration) => {
		common.runCommand(async () => {
			const cwd = process.cwd();

			const detectedPm = await detect({ cwd });
			const selectedPm = detectedPm?.agent ?? null;

			if (!selectedPm) throw new Error('Unable to detect package manage');

			const { command, args } = constructCommand(COMMANDS[selectedPm].execute, [
				'svelte-migrate@latest',
				migration
			])!;

			await exec(command, args, { nodeOptions: { cwd, stdio: 'inherit' } });
		});
	});
