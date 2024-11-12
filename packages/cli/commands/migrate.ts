import { execSync } from 'node:child_process';
import process from 'node:process';
import { Command } from 'commander';
import { resolveCommand } from 'package-manager-detector';
import { getUserAgent } from '../utils/package-manager.ts';

export const migrate = new Command('migrate')
	.description('a CLI for migrating Svelte(Kit) codebases')
	.argument('<migration>', 'migration to run')
	.option('-C, --cwd <path>', 'path to working directory', process.cwd())
	.configureHelp({
		formatHelp() {
			// we'll pass the responsibility of presenting the help menu over to `svelte-migrate`
			runMigrate(process.cwd(), ['--help']);
			return '';
		}
	})
	.action((migration, options) => {
		runMigrate(options.cwd, [migration]);
	});

function runMigrate(cwd: string, args: string[]) {
	const pm = getUserAgent() ?? 'npm';

	// avoids printing the stack trace for `sv` when `svelte-migrate` exits with an error code
	try {
		const cmdArgs = ['svelte-migrate@latest', ...args];

		// skips the download confirmation prompt for `npx`
		if (pm === 'npm') cmdArgs.unshift('--yes');

		const cmd = resolveCommand(pm, 'execute', cmdArgs)!;
		execSync(`${cmd.command} ${cmd.args.join(' ')}`, { stdio: 'inherit', cwd });
	} catch {}
}
