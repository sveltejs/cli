import { Command } from 'commander';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { resolveCommand } from 'package-manager-detector';

import { forwardExitCode } from './utils/common.js';
import { getUserAgent } from './utils/package-manager.js';

export const migrate = new Command('migrate')
	.description('a CLI for migrating Svelte(Kit) codebases')
	.argument('[migration]', 'migration to run')
	.option('-C, --cwd <path>', 'path to working directory', process.cwd())
	.action((migration, options) => {
		runMigrate(options.cwd, [migration]);
	});

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function runMigrate(cwd, args) {
	const pm = getUserAgent() ?? 'npm';

	// avoids printing the stack trace for `sv` when `svelte-migrate` exits with an error code
	try {
		const cmdArgs = ['svelte-migrate@latest', ...args];

		// skips the download confirmation prompt for `npx`
		if (pm === 'npm') cmdArgs.unshift('--yes');

		const cmd = resolveCommand(pm, 'execute', cmdArgs);
		if (!cmd) {
			console.error('Failed to resolve svelte-migrate command');
			process.exit(1);
		}
		execSync(`${cmd.command} ${cmd.args.join(' ')}`, { stdio: 'inherit', cwd });
	} catch (error) {
		forwardExitCode(error);
	}
}
