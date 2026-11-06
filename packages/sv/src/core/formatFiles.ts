import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { type AgentName, loadPackageJson, resolveCommand } from '@sveltejs/sv-utils';
import * as resolve from 'empathic/resolve';
import * as walk from 'empathic/walk';
import { exec, NonZeroExitError } from 'tinyexec';
import { isNodeError } from './common.js';
import { detectPackageManager } from './package-manager.ts';
import { findWorkspaceRoot } from './workspace.ts';

/**
 * The one formatting policy, shared by `sv create`, `sv add` and `sv migrate`:
 * run the nearest `format`/`fmt` script up to the workspace root (the script
 * owns its scope and deps). If none exists, run `prettier --write` on the
 * files to format when `prettier` is resolvable. Otherwise skip altogether.
 */
export async function formatFiles(options: {
	packageManager: AgentName;
	cwd: string;
	filesToFormat: string[];
}): Promise<void> {
	if (options.filesToFormat.length === 0) return;

	const script = findFormatScript(options.cwd);
	if (!script && !isPrettierInstalled(options.cwd)) return;

	if (script) {
		// the script owns its scope (whole repo/monorepo) and deps - we don't care what runs under it
		const packageManager = await detectPackageManager(script.dir);
		const cmd = resolveCommand(packageManager, 'run', [script.name])!;
		await withSpinner(`Running ${packageManager} run ${script.name}`, () =>
			run(cmd.command, cmd.args, script.dir)
		);
		return;
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

/**
 * Whether `prettier` resolves from `cwd` via Node's module resolution.
 */
export function isPrettierInstalled(cwd: string): boolean {
	return Boolean(resolve.from(cwd, 'prettier', true));
}

/** Nearest dir from `cwd` up to the workspace root with a `format` or `fmt` package.json script. */
export function findFormatScript(cwd: string): { dir: string; name: 'format' | 'fmt' } | undefined {
	const workspaceRoot = findWorkspaceRoot(cwd);
	for (const directory of walk.up(path.resolve(cwd), { last: workspaceRoot })) {
		if (!fs.existsSync(path.join(directory, 'package.json'))) return;

		const { data } = loadPackageJson(directory);
		if (data.scripts?.format) return { dir: directory, name: 'format' };
		if (data.scripts?.fmt) return { dir: directory, name: 'fmt' };
	}
	return;
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
		await exec(command, args, { nodeOptions: { cwd, stdio: 'pipe' }, throwOnError: true });
		return {};
	} catch (e) {
		if (e instanceof NonZeroExitError) {
			// failures can land on either stream, so report both
			const { stdout, stderr } = e.output ?? {};
			const message = [stderr, stdout].filter(Boolean).join('\n').trim();
			return { error: message };
		}
		if (!isNodeError(e)) return { error: 'unknown error' };
		if (e.code === 'ENOENT') return { notFound: true, error: `${command} not found` };
		return { error: e.message };
	}
}
