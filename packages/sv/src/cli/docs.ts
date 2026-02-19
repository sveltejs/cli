import { resolveCommand } from '@sveltejs/sv-utils';
import { Command } from 'commander';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { forwardExitCode } from '../core/common.ts';
import { detectPackageManager } from '../core/package-manager.ts';

export const docs = new Command('docs')
	.description('fetch Svelte/SvelteKit documentation from the terminal')
	.argument(
		'[section]',
		'documentation section to fetch (e.g. "$state", "routing", "load functions")'
	)
	.option('--list', 'list all available documentation sections')
	.addHelpText(
		'after',
		`
Examples:
  npx sv docs --list             list all available sections
  npx sv docs svelte/snippet	   fetch docs for svelte snippets
  npx sv docs kit/routing        fetch docs for routing`
	)
	.action(async (section, options) => {
		if (options.list) {
			await runDocs(['list-sections']);
		} else if (section) {
			await runDocs(['get-documentation', section]);
		} else {
			// no section and no --list: show help
			docs.help();
		}
	});

async function runDocs(args: string[]) {
	const cwd = process.cwd();
	const pm = await detectPackageManager(cwd);

	try {
		const cmdArgs = ['@sveltejs/mcp@latest', ...args];

		// skips the download confirmation prompt for `npx`
		if (pm === 'npm') cmdArgs.unshift('--yes');

		const cmd = resolveCommand(pm, 'execute', cmdArgs)!;
		execSync(`${cmd.command} ${cmd.args.join(' ')}`, { stdio: 'inherit' });
	} catch (error) {
		forwardExitCode(error);
	}
}
