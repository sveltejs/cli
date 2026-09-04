import { execSync } from 'node:child_process';
import { coerceVersion } from './semver.ts';

export function detectPnpmMajor(cwd: string): number | undefined {
	try {
		const out = execSync('pnpm --version', {
			cwd,
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
		return coerceVersion(out.trim()).major;
	} catch {
		return undefined;
	}
}
