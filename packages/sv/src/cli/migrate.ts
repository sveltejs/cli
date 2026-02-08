import { resolveCommand } from '@sveltejs/sv-utils';
import { Command } from 'commander';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { forwardExitCode } from '../core/common.ts';
import { detectPackageManager } from '../core/package-manager.ts';

export const migrate = new Command('migrate')
	.description('a CLI for migrating Svelte(Kit) codebases')
	.argument('[migration]', 'migration to run')
	.option('-C, --cwd <path>', 'path to working directory', process.cwd())
	.action(async (migration, options) => {
		await runMigrate(options.cwd, [migration]);
	});

async function runMigrate(cwd: string, args: string[]) {
	const pm = await detectPackageManager(cwd);

	// avoids printing the stack trace for `sv` when `svelte-migrate` exits with an error code
	try {
		const cmdArgs = ['svelte-migrate@latest', ...args];

		// skips the download confirmation prompt for `npx`
		if (pm === 'npm') cmdArgs.unshift('--yes');

		const cmd = resolveCommand(pm, 'execute', cmdArgs)!;
		execSync(`${cmd.command} ${cmd.args.join(' ')}`, { stdio: 'inherit', cwd });
	} catch (error) {
		forwardExitCode(error);
	}
}
