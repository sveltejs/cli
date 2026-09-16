import { spawnSync } from 'node:child_process';
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
	try {
		// windows
		if (process.platform === 'win32') {
			return spawnSync('where', [command], { stdio: 'ignore' }).status === 0;
		}

		// unix
		return spawnSync('command', ['-v', command], { stdio: 'ignore' }).status === 0;
	} catch {
		return false;
	}
}
