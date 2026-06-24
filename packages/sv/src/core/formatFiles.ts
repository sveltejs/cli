import * as p from '@clack/prompts';
import { type AgentName, loadPackageJson, resolveCommand } from '@sveltejs/sv-utils';
import { exec } from 'tinyexec';
import fs from 'node:fs';
import path from 'node:path';
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
			await run(cmd.command, cmd.args, script.dir, `Running ${packageManager} run ${script.name}`);
			return;
		}
	}

	const cmd = resolveCommand(options.packageManager, 'execute-local', [
		'prettier',
		'--write',
		'--ignore-unknown',
		...options.filesToFormat
	])!;
	await run(cmd.command, cmd.args, options.cwd, 'Formatting modified files');
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

async function run(command: string, args: string[], cwd: string, startMsg: string): Promise<void> {
	const { start, stop } = p.spinner();
	start(startMsg);
	try {
		const result = await exec(command, args, {
			nodeOptions: { cwd, stdio: 'pipe' },
			throwOnError: true
		});
		if (result.exitCode !== 0) {
			stop('Failed to format files');
			p.log.error(result.stderr);
			return;
		}
	} catch (e) {
		stop('Failed to format files');
		// @ts-expect-error
		p.log.error(e?.output?.stderr || 'unknown error');
		return;
	}
	stop('Successfully formatted files');
}
