import { execSync } from 'node:child_process';
import pc from 'picocolors';
import * as resolve from 'empathic/resolve';
import { Command } from 'commander';
import { resolveCommand } from 'package-manager-detector/commands';
import { getUserAgent } from '../common.ts';

export const check = new Command('check')
	.description('a CLI for checking your Svelte code')
	// flags that we'll want to pass to `svelte-check`
	.allowUnknownOption(true)
	.option('-C, --cwd <path>', 'path to working directory', process.cwd())
	.configureHelp({
		formatHelp() {
			// we'll pass the responsibility of presenting the help menu over to `svelte-check`
			runCheck(process.cwd(), ['--help']);
			return '';
		}
	})
	.action((options, check: Command) => {
		const cwd: string = options.cwd;
		const args: string[] = check.args;

		runCheck(cwd, args);
	});

function runCheck(cwd: string, args: string[]) {
	const pm = getUserAgent() ?? 'npm';

	// validates that `svelte-check` is locally installed
	const resolved = resolve.from(cwd, 'svelte-check', true);
	if (!resolved) {
		const cmd = resolveCommand(pm, 'add', ['-D', 'svelte-check'])!;
		console.error(
			`'svelte-check' is not installed locally. Install it with: ${pc.bold(`${cmd.command} ${cmd.args.join(' ')}`)}`
		);
		process.exit(1);
	}

	// avoids printing the stack trace for `sv` when `svelte-check` exits with an error code
	try {
		execSync(`npx svelte-check ${args.join(' ')}`, { stdio: 'inherit', cwd });
	} catch {}
}