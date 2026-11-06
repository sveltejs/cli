import {
	allowBuildsByVersion,
	detectPnpmVersion,
	readsWorkspaceSettings
} from './pnpm-internals.ts';
import { type TransformFn } from './tooling/transforms.ts';

/**
 * Returns a TransformFn for `pnpm-workspace.yaml` that adds packages to the
 * pnpm "allow builds" config.
 *
 * ```ts
 * if (packageManager === 'pnpm') {
 *   sv.file(
 *     file.findUp('pnpm-workspace.yaml'),
 *     pnpm.allowBuilds({ cwd, packages: ['my-native-dep'] })
 *   );
 * }
 * ```
 *
 * The version of pnpm that would run in `cwd` decides the shape:
 * - on pnpm `>= 10.26`, uses `allowBuilds` (`{ pkg: true }`),
 *   migrating any legacy `onlyBuiltDependencies`;
 * - on pnpm `10.5`–`10.25` uses `onlyBuiltDependencies`;
 * - on pnpm `< 10.5` writes nothing.
 *
 * `allowBuilds` was introduced in pnpm 10.26; pnpm 11 removed the legacy
 * build settings: https://pnpm.io/blog/releases/10.26
 */
export function allowBuilds(options: {
	/** Target project directory, whose pnpm version decides which config shape is written. */
	cwd: string;
	packages: string[];
}): TransformFn {
	return allowBuildsByVersion(detectPnpmVersion(options.cwd), options.packages);
}

/**
 * Whether the pnpm that would run in `cwd` reads settings from `pnpm-workspace.yaml`.
 *
 * @deprecated This function doesn't provide the resolution needed for version-specific
 * logic. It is superseded by {@link detectPnpmVersion}, which you can use to write the branching logic.
 */
export function supportsWorkspaceSettings(cwd: string): boolean {
	return readsWorkspaceSettings(detectPnpmVersion(cwd));
}
