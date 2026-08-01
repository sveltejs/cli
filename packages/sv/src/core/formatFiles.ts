import * as p from '@clack/prompts';
import { type AgentName, loadPackageJson, resolveCommand } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import path from 'node:path';
import { exec, NonZeroExitError } from 'tinyexec';
import { detectPackageManager } from './package-manager.ts';
import { findWorkspaceRoot } from './workspace.ts';

export type FormatStrategy =
	/** Run the nearest `format`/`fmt` script up to the workspace root, else format the files. */
	| 'project-script-then-files-only'
	/** Run `prettier --write` on the given files (if `prettier` is available). */
	| 'files-only';

export async function formatFiles(options: {
	packageManager: AgentName;
	cwd: string;
	filesToFormat: string[];
	strategy: FormatStrategy;
}): Promise<void> {
	if (options.filesToFormat.length === 0) return;

	if (options.strategy === 'project-script-then-files-only') {
		const script = findFormatScript(options.cwd);
		if (script) {
			// the script owns its scope (whole repo/monorepo) and deps - we don't care what runs under it
			const packageManager = await detectPackageManager(script.dir);
			const cmd = resolveCommand(packageManager, 'run', [script.name])!;
			await withSpinner(`Running ${packageManager} run ${script.name}`, () =>
				run(cmd.command, cmd.args, script.dir)
			);
			return;
		}
	}

	const args = ['--write', '--ignore-unknown', ...options.filesToFormat];
	await withSpinner('Formatting modified files', async () => {
		// tinyexec resolves `prettier` from `node_modules/.bin`; going through the package
		// manager can fail on unrelated state (e.g. pnpm refusing to run while build scripts
		// are unapproved), but it's the only way to reach binaries under Yarn PnP
		let result = await run('prettier', args, options.cwd);
		if (result.notFound) {
			const cmd = resolveCommand(options.packageManager, 'execute-local', ['prettier', ...args])!;
			result = await run(cmd.command, cmd.args, options.cwd);
		}
		return result;
	});
}

/** Nearest dir from `cwd` up to the workspace root with a `format` or `fmt` package.json script. */
function findFormatScript(cwd: string): { dir: string; name: 'format' | 'fmt' } | undefined {
	const workspaceRoot = findWorkspaceRoot(cwd);
	let directory = path.resolve(cwd);
	const { root } = path.parse(directory);
	while (directory && directory.length >= workspaceRoot.length) {
		if (fs.existsSync(path.join(directory, 'package.json'))) {
			const { data } = loadPackageJson(directory);
			if (data.scripts?.format) return { dir: directory, name: 'format' };
			if (data.scripts?.fmt) return { dir: directory, name: 'fmt' };
		}
		if (directory === root) break;
		directory = path.dirname(directory);
	}
	return undefined;
}

async function withSpinner(
	startMsg: string,
	task: () => Promise<{ error?: string }>
): Promise<void> {
	const { start, stop } = p.spinner();
	start(startMsg);
	const { error } = await task();
	if (error !== undefined) {
		stop('Failed to format files');
		p.log.error(error);
		return;
	}
	stop('Successfully formatted files');
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
