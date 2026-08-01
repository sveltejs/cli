import { resolveCommand } from '@sveltejs/sv-utils';
import { Command } from 'commander';
import process from 'node:process';
import { execSync } from 'tinyexec';
import { forwardExitCode } from '../core/common.ts';
import { detectPackageManager } from '../core/package-manager.ts';

export const migrate = new Command('migrate')
	.description('a CLI for migrating Svelte(Kit) codebases')
	.argument('[migration]', 'migration to run')
	.option('-C, --cwd <path>', 'path to working directory', process.cwd())
	.action((migration, options) => runMigrate(options.cwd, [migration]));

async function runMigrate(cwd: string, args: string[]) {
	const pm = await detectPackageManager(cwd);

	// avoids printing the stack trace for `sv` when `svelte-migrate` exits with an error code
	try {
		const newArgs = [
			// skips the download confirmation prompt for `npx`
			...(pm === 'npm' ? '--yes' : ''),
			'svelte-migrate@latest',
			...args
		];

		const cmd = resolveCommand(pm, 'execute', newArgs)!;
		execSync(cmd.command, cmd.args, { nodeOptions: { cwd, stdio: 'inherit' } });
	} catch (error) {
		forwardExitCode(error);
	}
}
