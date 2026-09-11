import { execSync } from 'node:child_process';
import os from 'node:os';
import { coerceVersion } from './semver.ts';

/**
 * Detects the major version of pnpm that would run in `cwd`.
 * Defaults to `os.tmpdir()` so detection is not pinned by the invoker's
 * `packageManager` / `devEngines.packageManager` field.
 */
export function detectPnpmMajor(cwd = os.tmpdir()): number | undefined {
	try {
		const out = execSync('pnpm --version', {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
			cwd
		});
		return coerceVersion(out.trim()).major;
	} catch {
		return undefined;
	}
}
