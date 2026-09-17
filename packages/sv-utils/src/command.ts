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
 * @throws if `command` is an empty string
 */
export function commandExists(command: string): boolean {
	if (command === '') throw new Error('`command` cannot be empty');

	const check = process.platform === 'win32' ? 'where' : 'command -v';

	try {
		execSync(`${check} ${command}`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}
