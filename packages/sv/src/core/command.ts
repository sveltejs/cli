import process from 'node:process';
import { execSync } from 'tinyexec';

export function commandExists(command: string): boolean {
	try {
		// windows
		if (process.platform === 'win32') {
			return execSync('where', [command], { nodeOptions: { stdio: 'ignore' } }).exitCode === 0;
		}

		// unix
		return (
			execSync(
				'command',
				['-v', command, ' 2>/dev/null', '&& { echo >&1', command, '; exit 0; }'],
				{ nodeOptions: { shell: true, stdio: 'ignore' } }
			).exitCode === 0
		);
	} catch {
		return false;
	}
}
