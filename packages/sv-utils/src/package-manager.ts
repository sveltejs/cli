import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { AGENTS, resolveCommand, type AgentName } from 'package-manager-detector';
import { allowBuildsByVersion } from './pnpm-internals.ts';
import { coerceVersion } from './semver.ts';
import type { SvFileApi } from './svelte-config.ts';

export type PackageManagerVersion = {
	major: number;
	minor: number;
	patch: number;
	/** Clean `major.minor.patch`, prerelease dropped. */
	version: string;
};

const versionByKey = new Map<string, PackageManagerVersion | undefined>();

/**
 * Version of `packageManager` that would run in `cwd`, or `undefined` when unknown.
 * Prefer the use-case helpers (`pm.allowBuilds`, ...) over branching on it.
 *
 * Runs `<packageManager> --version` from `cwd`, so the target project's pin wins over the invoker's.
 * Results are memoised: pnpm self-manages versions, so a miss can download a whole release.
 */
export function version(options: {
	cwd: string;
	packageManager: AgentName;
}): PackageManagerVersion | undefined {
	const cwd = path.resolve(options.cwd);
	const key = `${options.packageManager}:${cwd}`;
	if (versionByKey.has(key)) return versionByKey.get(key);

	let result: PackageManagerVersion | undefined;
	// guards `execSync` against anything that isn't a known agent
	if (AGENTS.includes(options.packageManager)) {
		try {
			const { command, args } = resolveCommand(options.packageManager, 'agent', ['--version'])!;
			const out = execSync(`${command} ${args.join(' ')}`, {
				encoding: 'utf-8',
				stdio: ['ignore', 'pipe', 'ignore'],
				cwd,
				// probing must never prompt or rewrite the project's `packageManager` pin
				env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', COREPACK_ENABLE_AUTO_PIN: '0' }
			});
			const { major, minor, patch, version } = coerceVersion(out.trim());
			if (version) result = { major: major!, minor: minor!, patch: patch!, version };
		} catch {
			result = undefined;
		}
	}

	versionByKey.set(key, result);
	return result;
}

/**
 * Allows `packages` to run their install scripts (native builds like `esbuild`, `sharp`).
 * Only pnpm blocks them today; other package managers are a no-op.
 *
 * ```ts
 * run: ({ sv, file, cwd, packageManager }) => {
 *   pm.allowBuilds({ sv, file, cwd, packageManager, packages: ['sharp'] });
 * }
 * ```
 */
export function allowBuilds(options: {
	sv: SvFileApi;
	file: { findUp: (filename: string) => string };
	/** Target project directory, whose package manager version decides the config shape. */
	cwd: string;
	packageManager: AgentName;
	packages: string[];
}): void {
	const { sv, file, cwd, packageManager, packages } = options;
	if (packageManager !== 'pnpm') return;

	const detected = version({ cwd, packageManager });
	sv.file(file.findUp('pnpm-workspace.yaml'), allowBuildsByVersion(detected?.version, packages));
}
