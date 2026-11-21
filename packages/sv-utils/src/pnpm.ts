import { version } from './package-manager.ts';
import { allowBuildsByVersion, readsWorkspaceSettings } from './pnpm-internals.ts';
import { type TransformFn } from './tooling/transforms.ts';

/**
 * Returns a TransformFn for `pnpm-workspace.yaml` that adds packages to the
 * pnpm "allow builds" config.
 *
 * @deprecated Use `pm.allowBuilds`, which also picks the file and skips other package managers.
 */
export function allowBuilds(options: {
	/** Target project directory, whose pnpm version decides which config shape is written. */
	cwd: string;
	packages: string[];
}): TransformFn {
	const detected = version({ cwd: options.cwd, packageManager: 'pnpm' });
	return allowBuildsByVersion(detected?.version, options.packages);
}

/**
 * Whether the pnpm that would run in `cwd` reads settings from `pnpm-workspace.yaml`.
 *
 * @deprecated Use `pm.version`.
 */
export function supportsWorkspaceSettings(cwd: string): boolean {
	return readsWorkspaceSettings(version({ cwd, packageManager: 'pnpm' })?.version);
}
