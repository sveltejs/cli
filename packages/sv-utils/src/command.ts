// code is sourced from https://github.com/mathisonian/command-exists/blob/master/lib/command-exists.js

import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

// Regex from Julio from: https://stackoverflow.com/questions/51494579/regex-windows-path-validator
const WINDOWS_COMMAND_REGEX =
	/^(?!(?:.*\s|.*\.|\W+)$)(?:[a-zA-Z]:)?(?:(?:[^<>:"|?*\n])+(?:\/\/|\/|\\\\|\\)?)+$/m;

/**
 * Checks whether a command is available on the `PATH` without running it.
 *
 * ```ts
 * import { commandExists } from '@sveltejs/sv-utils';
 *
 * if (!commandExists('docker')) {
 * 	console.log('docker is not installed');
 * }
 * ```
 *
 * @param command the command name to look up (e.g. `'git'`, `'bun'`)
 * @returns `true` if the command can be found, `false` otherwise
 * @throws if `command` is an empty string
 */
export function commandExists(command: string): boolean {
	if (command === '') throw new Error('`command` cannot be empty');

	const isWindows = process.platform === 'win32';
	if (isWindows && !WINDOWS_COMMAND_REGEX.test(command)) return false;

	const check = isWindows
		? `where ${cleanInputWindows(command)}`
		: `command -v ${cleanInput(command)}`;

	try {
		execSync(check, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function cleanInput(s: string): string {
	if (/[^A-Za-z0-9_/:=-]/.test(s)) {
		s = `'${s.replace(/'/g, `'\\''`)}'`;
		s = s
			.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
			.replace(/\\'''/g, `\\'`); // remove non-escaped single-quote if there are enclosed between 2 escaped
	}
	return s;
}

function cleanInputWindows(s: string): string {
	if (/[\\]/.test(s)) {
		const dirname = `"${path.dirname(s)}"`;
		const basename = `"${path.basename(s)}"`;
		return `${dirname}:${basename}`;
	}
	return `"${s}"`;
}
