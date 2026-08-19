import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { type AgentName, loadPackageJson, resolveCommand } from '@sveltejs/sv-utils';
import { exec } from 'tinyexec';
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
		// Prefer calling `prettier` from the project's `node_modules/.bin`. Going through the
		// package manager can fail on unrelated state (e.g. pnpm refusing to run while build
		// scripts are unapproved), but it's the only way to reach binaries under Yarn PnP.
		let result = await run('prettier', args, options.cwd);
		if (result.error) {
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

async function run(command: string, args: string[], cwd: string): Promise<{ error?: string }> {
	try {
		await exec(command, args, { nodeOptions: { cwd, stdio: 'pipe' }, throwOnError: true });
		return {};
	} catch (e) {
		// Unix spawn of a missing binary is ENOENT. On Windows, tinyexec often runs via
		// cmd.exe which exits 1 with "is not recognized..." instead. We'll treat both as errors
		// so we can fall back to the package manager (needed for Yarn PnP).
		if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
			if ('code' in e && e.code === 'ENOENT') {
				return { error: `${command} not found` };
			}

			return { error: e.message };
		}

		return { error: 'unknown error' };
	}
}
