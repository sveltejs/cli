import { Command } from 'commander';
import * as resolve from 'empathic/resolve';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { resolveCommand } from 'package-manager-detector/commands';
import pc from 'picocolors';

import { forwardExitCode } from './utils/common.js';
import { getUserAgent } from './utils/package-manager.js';

export const check = new Command('check')
	.description('a CLI for checking your Svelte code')
	// flags that we'll want to pass to `svelte-check`
	.allowUnknownOption(true)
	.allowExcessArguments(true)
	.option('-C, --cwd <path>', 'path to working directory', process.cwd())
	.configureHelp({
		formatHelp() {
			// we'll pass the responsibility of presenting the help menu over to `svelte-check`
			runCheck(process.cwd(), ['--help']);
			return '';
		}
	})
	.action(
		/** @param {any} options @param {Command} check */
		(options, check) => {
			/** @type {string} */
			const cwd = options.cwd;
			/** @type {string[]} */
			const args = check.args;

			runCheck(cwd, args);
		}
	);

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function runCheck(cwd, args) {
	const pm = getUserAgent() ?? 'npm';

	// validates that `svelte-check` is locally installed
	const resolved = resolve.from(cwd, 'svelte-check', true);
	if (!resolved) {
		const cmd = resolveCommand(pm, 'add', ['-D', 'svelte-check']);
		if (!cmd) {
			console.error("'svelte-check' is not installed locally.");
			process.exit(1);
		}
		console.error(
			`'svelte-check' is not installed locally. Install it with: ${pc.bold(`${cmd.command} ${cmd.args.join(' ')}`)}`
		);
		process.exit(1);
	}

	// avoids printing the stack trace for `sv` when `svelte-check` exits with an error code
	try {
		const cmd = resolveCommand(pm, 'execute-local', ['svelte-check', ...args]);
		if (!cmd) {
			console.error('Failed to resolve svelte-check command');
			process.exit(1);
		}
		execSync(`${cmd.command} ${cmd.args.join(' ')}`, { stdio: 'inherit', cwd });
	} catch (error) {
		forwardExitCode(error);
	}
}
