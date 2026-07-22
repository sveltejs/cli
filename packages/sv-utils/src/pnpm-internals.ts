import { execSync } from 'node:child_process';
import { coerceVersion } from './semver.ts';

export function detectPnpmMajor(): number | undefined {
	try {
		const out = execSync('pnpm --version', {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
		return coerceVersion(out.trim()).major;
	} catch {
		return undefined;
	}
}
