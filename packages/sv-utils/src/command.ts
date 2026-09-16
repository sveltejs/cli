import { execSync } from 'node:child_process';
import process from 'node:process';

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
 */
export function commandExists(command: string): boolean {
	if (command === '') throw Error('`Command cannot be empty');
	const _command = process.platform === 'win32' ? `where` : `command -v`;

	try {
		execSync(`${_command} ${command}`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}
