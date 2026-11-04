import { allowBuildsForVersion, detectPnpmVersion } from './pnpm-internals.ts';
import { type TransformFn } from './tooling/transforms.ts';

/**
 * Returns a TransformFn for `pnpm-workspace.yaml` that adds packages to the
 * pnpm "allow builds" config.
 *
 * ```ts
 * if (packageManager === 'pnpm') {
 *   sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds({ cwd, packages: ['my-native-dep'] }));
 * }
 * ```
 *
 * The version of pnpm that would run in `cwd` decides the shape:
 * - on pnpm `>= 10.26`, writes to the unified `allowBuilds` map (`{ pkg: true }`),
 *   migrating any legacy `onlyBuiltDependencies` list into the map;
 * - on pnpm `10.5`–`10.25` writes to the legacy `onlyBuiltDependencies` list;
 * - on pnpm `< 10.5` writes nothing — `pnpm-workspace.yaml` must list
 *   `packages`, so a settings-only file breaks `pnpm install`.
 *
 * `allowBuilds` was introduced in pnpm 10.26; pnpm 11 removed the legacy
 * build settings: https://pnpm.io/blog/releases/10.26
 */
export function allowBuilds(options: { cwd: string; packages: string[] }): TransformFn {
	return allowBuildsForVersion(detectPnpmVersion(options.cwd), options.packages);
}
