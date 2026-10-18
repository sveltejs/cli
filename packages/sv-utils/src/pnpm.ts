import {
	detectPnpmMajor,
	detectPnpmVersion,
	readsWorkspaceSettings,
	writeAllowBuilds,
	writeLegacy
} from './pnpm-internals.ts';
import { type TransformFn } from './tooling/transforms.ts';

/**
 * Returns a TransformFn for `pnpm-workspace.yaml` that adds packages to the
 * pnpm "allow builds" config.
 *
 * The version of pnpm that would run in `cwd` decides the shape:
 * - on pnpm `>= 11` writes to the unified `allowBuilds` map (`{ pkg: true }`),
 *   migrating any legacy `onlyBuiltDependencies` list into the map;
 * - on pnpm `< 11` writes to the legacy `onlyBuiltDependencies` list;
 * - on pnpm `< 10.5` writes nothing (see {@link supportsWorkspaceSettings}).
 *
 * ```ts
 * if (packageManager === 'pnpm') {
 *   sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds({ cwd, packages: ['my-native-dep'] }));
 * }
 * ```
 */
export function allowBuilds(options: {
	/** Target project directory, whose pnpm version decides which config shape is written. */
	cwd: string;
	packages: string[];
}): TransformFn {
	const { cwd, packages } = options;
	if (!supportsWorkspaceSettings(cwd)) return () => false;
	const major = detectPnpmMajor(cwd);
	if (major !== undefined && major < 11) return writeLegacy(packages);
	return writeAllowBuilds(packages);
}

/** Whether the pnpm that would run in `cwd` reads settings from `pnpm-workspace.yaml`. */
export function supportsWorkspaceSettings(cwd: string): boolean {
	return readsWorkspaceSettings(detectPnpmVersion(cwd));
}
