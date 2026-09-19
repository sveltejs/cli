import { detectPnpmMajor, writeAllowBuilds, writeLegacy } from './pnpm-internals.ts';
import { type TransformFn } from './tooling/transforms.ts';

export type AllowBuildsOptions = {
	/** Target project directory, whose pnpm version decides which config shape is written. */
	cwd: string;
	packages: string[];
};

/**
 * Returns a TransformFn for `pnpm-workspace.yaml` that adds packages to the
 * pnpm "allow builds" config.
 *
 * The version of pnpm that would run in `cwd` decides the shape:
 * - on pnpm `>= 11` writes to the unified `allowBuilds` map (`{ pkg: true }`),
 *   migrating any legacy `onlyBuiltDependencies` list into the map;
 * - on pnpm `< 11` writes to the legacy `onlyBuiltDependencies` list.
 *
 * ```ts
 * if (packageManager === 'pnpm') {
 *   sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds({ cwd, packages: ['my-native-dep'] }));
 * }
 * ```
 */
export function allowBuilds({ cwd, packages }: AllowBuildsOptions): TransformFn {
	const major = detectPnpmMajor(cwd);
	if (major !== undefined && major < 11) return writeLegacy(packages);
	return writeAllowBuilds(packages);
}
