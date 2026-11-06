import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { type AgentName, loadPackageJson, resolveCommand } from '@sveltejs/sv-utils';
import * as walk from 'empathic/walk';
import { exec, NonZeroExitError } from 'tinyexec';
import { isNodeError } from './common.js';
import { detectPackageManager } from './package-manager.ts';
import { findWorkspaceRoot } from './workspace.ts';

/**
 * The one formatting policy, shared by `sv create`, `sv add` and `sv migrate`:
 * run the nearest `format`/`fmt` script up to the workspace root. The script
 * owns its scope, its config and its tooling — `sv` never invokes a formatter
 * directly, so projects without such a script are left untouched.
 */
export async function formatFiles(options: {
	packageManager: AgentName;
	cwd: string;
	filesToFormat: string[];
}): Promise<void> {
	const script = findFormatScript(options.cwd);
	if (!script) return;

	const packageManager = await detectPackageManager(script.dir);
	const cmd = resolveCommand(packageManager, 'run', [script.name])!;
	await withSpinner(`Running ${packageManager} run ${script.name}`, () =>
		run(cmd.command, cmd.args, script.dir)
	);
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
