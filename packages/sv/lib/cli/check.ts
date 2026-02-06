import { Command } from 'commander';
import * as resolve from 'empathic/resolve';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { color, resolveCommand } from '@sveltejs/sv-utils';

import { forwardExitCode } from '../core/common.ts';
import { detectPackageManager } from '../core/package-manager.ts';

export const check = new Command('check')
	.description('a CLI for checking your Svelte code')
	// flags that we'll want to pass to `svelte-check`
	.allowUnknownOption(true)
	.allowExcessArguments(true)
	.option('-C, --cwd <path>', 'path to working directory', process.cwd())
	.helpOption(false) // we'll pass the responsibility of presenting the help menu over to `svelte-check`
	.action(async (options, check: Command) => {
		const cwd: string = options.cwd;
		const args: string[] = check.args;

		await runCheck(cwd, args);
	});

async function runCheck(cwd: string, args: string[]) {
	const pm = await detectPackageManager(cwd);

	// validates that `svelte-check` is locally installed
	const resolved = resolve.from(cwd, 'svelte-check', true);
	if (!resolved) {
		const cmd = resolveCommand(pm, 'add', ['-D', 'svelte-check'])!;
		console.error(
			`'svelte-check' is not installed locally. Install it with: ${color.command(`${cmd.command} ${cmd.args.join(' ')}`)}`
		);
		process.exit(1);
	}

	if (args.includes('--help')) {
		console.log(`All svelte-check [options] are available in sv check [options]`);
		console.log('Find here all options for both tools');
	}

	// avoids printing the stack trace for `sv` when `svelte-check` exits with an error code
	try {
		const cmd = resolveCommand(pm, 'execute-local', ['svelte-check', ...args])!;
		execSync(`${cmd.command} ${cmd.args.join(' ')}`, { stdio: 'inherit', cwd });
	} catch (error) {
		forwardExitCode(error);
	} finally {
		if (args.includes('--help')) {
			check.help();
		}
	}
}
