import process from 'node:process';
import { execSync } from 'node:child_process';
import pc from 'picocolors';
import { Command } from 'commander';
import * as resolve from 'empathic/resolve';
import { resolveCommand } from 'package-manager-detector/commands';
import { getUserAgent } from './package-manager.ts';

export function createCommand(
	name: string,
	package_name: string,
	package_binary: string,
	description: string
) {
	return (
		new Command(name)
			.description(description)
			// allow options for the external package
			.allowUnknownOption(true)
			.option('-C, --cwd <path>', 'path to working directory', process.cwd())
			.configureHelp({
				formatHelp() {
					// pass the responsibility of presenting the help menu over to the external package
					runPackage(package_name, package_binary, process.cwd(), ['--help']);
					return '';
				}
			})
			.action((options, check: Command) => {
				const cwd: string = options.cwd;
				const args: string[] = check.args;

				runPackage(package_name, package_binary, cwd, args);
			})
	);
}

function runPackage(name: string, binary: string, cwd: string, args: string[]) {
	const pm = getUserAgent() ?? 'npm';

	// validates that the package is locally installed
	// try to find package.json as package might not have a main export
	const resolved = resolve.from(cwd, `${name}/package.json`, true);
	if (!resolved) {
		const cmd = resolveCommand(pm, 'add', ['-D', name])!;
		console.error(
			`'${name}' is not installed locally. Install it with: ${pc.bold(`${cmd.command} ${cmd.args.join(' ')}`)}`
		);
		process.exit(1);
	}

	// avoids printing the stack trace for `sv` when the external package exits with an error code
	try {
		const cmd = resolveCommand(pm, 'execute-local', [binary, ...args])!;
		execSync(`${cmd.command} ${cmd.args.join(' ')}`, { stdio: 'inherit', cwd });
	} catch {}
}
