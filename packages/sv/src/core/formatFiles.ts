import * as p from '@clack/prompts';
import { type AgentName, resolveCommand } from '@sveltejs/sv-utils';
import { exec, NonZeroExitError } from 'tinyexec';

export async function formatFiles(options: {
	packageManager: AgentName;
	cwd: string;
	filesToFormat: string[];
}): Promise<void> {
	if (options.filesToFormat.length === 0) return;
	const { start, stop } = p.spinner();
	start('Formatting modified files');

	const args = ['--write', '--ignore-unknown', ...options.filesToFormat];

	// tinyexec resolves `prettier` from `node_modules/.bin`; going through the package
	// manager can fail on unrelated state (e.g. pnpm refusing to run while build scripts
	// are unapproved), but it's the only way to reach binaries under Yarn PnP
	let result = await run('prettier', args, options.cwd);
	if (result.notFound) {
		const cmd = resolveCommand(options.packageManager, 'execute-local', ['prettier', ...args])!;
		result = await run(cmd.command, cmd.args, options.cwd);
	}

	if (result.error !== undefined) {
		stop('Failed to format files');
		p.log.error(result.error);
		return;
	}
	stop('Successfully formatted modified files');
}

async function run(
	command: string,
	args: string[],
	cwd: string
): Promise<{ error?: string; notFound?: boolean }> {
	try {
		await exec(command, args, { nodeOptions: { cwd }, throwOnError: true });
		return {};
	} catch (e) {
		// tinyexec rethrows the spawn error as-is
		if ((e as NodeJS.ErrnoException | null)?.code === 'ENOENT') {
			return { notFound: true, error: `${command} not found` };
		}
		if (e instanceof NonZeroExitError) {
			// failures can land on either stream, so report both
			const { stderr, stdout } = e.output ?? {};
			const message = [stderr, stdout].filter(Boolean).join('\n').trim();
			return { error: message || e.message };
		}
		if (e instanceof Error) return { error: e.message };
		return { error: 'unknown error' };
	}
}
