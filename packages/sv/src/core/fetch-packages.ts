import fs from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { color, coerceVersion, downloadJson } from '@sveltejs/sv-utils';
import * as packageJson from 'empathic/package';
import { unpackTar } from 'modern-tar/fs';
import * as v from 'valibot';
import pkg from '../../package.json' with { type: 'json' };
import * as common from './common.ts';
import { PackageJSON } from './common.ts';
import type { AddonDefinition, AddonReference } from './config.ts';

const packageJsonPath = packageJson.up({ cwd: import.meta.dirname });
if (!packageJsonPath) throw new Error('Could not locate the `package.json` of `sv`');
/** path to the `node_modules` directory of `sv` */
const NODE_MODULES = path.join(path.dirname(packageJsonPath), 'node_modules');

const SV_UTILS = '@sveltejs/sv-utils';
// exact once published (pnpm rewrites `workspace:*`), so the mismatch check is skipped in dev
const SV_UTILS_VERSION: string = pkg.dependencies[SV_UTILS];

type PackageBlocklist = { npm_names: string[] };

function parsePackageJSON(value: unknown, specifier: string): PackageJSON {
	const result = v.safeParse(PackageJSON, value);
	if (!result.success) {
		throw new Error(
			`Invalid add-on package specified: '${specifier}' has invalid package metadata`
		);
	}
	return result.output;
}

export function verifyPackage(
	addonPkg: PackageJSON,
	specifier: string,
	svUtilsVersion = SV_UTILS_VERSION
): string | undefined {
	const peerDeps = { ...addonPkg.peerDependencies };

	// valid addons should always have `sv` as a peerDependency
	const addonSvVersion = peerDeps['sv'];
	if (!addonSvVersion) {
		throw new Error(
			`Invalid add-on package specified: '${specifier}' is missing 'sv' in its 'peerDependencies'`
		);
	}

	const addonSv = coerceVersion(addonSvVersion);
	const builtFor = addonSv.version ?? addonSvVersion;
	const rerun =
		`This may cause compatibility issues. If it fails, run it with the sv it was built for:\n` +
		color.optional(`npx sv@${builtFor} add ${specifier}`);

	if (coerceVersion(pkg.version).major !== addonSv.major) {
		return (
			`${color.addon(specifier)} was built for ${color.warning(`sv@${builtFor}`)} but you're running ${color.addon(`sv@${pkg.version}`)}.\n` +
			rerun
		);
	}

	// an unbundled `@sveltejs/sv-utils` resolves to the copy `sv` ships
	const addonSvUtils = peerDeps[SV_UTILS];
	const svUtils = coerceVersion(svUtilsVersion);
	if (
		addonSvUtils &&
		svUtils.major !== undefined &&
		coerceVersion(addonSvUtils).major !== svUtils.major
	) {
		return (
			`${color.addon(specifier)} was built for ${color.warning(`${SV_UTILS}@${addonSvUtils}`)} but ${color.addon(`sv@${pkg.version}`)} ships ${color.addon(`${SV_UTILS}@${svUtils.version}`)}.\n` +
			rerun
		);
	}
}

/**
 * Recursively copies a directory from source to destination
 * Skips node_modules directories
 */
function copyDirectorySync(src: string, dest: string) {
	const stats = fs.statSync(src);
	if (stats.isDirectory()) {
		// Skip node_modules directories - they'll be installed separately
		if (path.basename(src) === 'node_modules') {
			return;
		}

		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}
		const entries = fs.readdirSync(src, { withFileTypes: true });
		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);

			if (entry.isDirectory()) {
				copyDirectorySync(srcPath, destPath);
			} else {
				fs.copyFileSync(srcPath, destPath);
			}
		}
	} else {
		fs.copyFileSync(src, dest);
	}
}

type DownloadOptions = { path?: string; pkg: PackageJSON };
/**
 * Downloads and installs the package into the `node_modules` of `sv`.
 * @returns the details of the downloaded addon
 */
export async function downloadPackage(options: DownloadOptions): Promise<AddonDefinition> {
	const { pkg } = options;

	// contents is written to `sv/node_modules/pkg-name`
	// so that we can dynamically import the package via `import(pkg-name)`
	const dest = path.join(NODE_MODULES, pkg.name.split('/').join(path.sep));

	// prevent old symlinks and caches from causing a stale install
	fs.rmSync(dest, { recursive: true, force: true });

	if (options.path) {
		// `symlinkSync` doesn't recursively create directories to the `destination` path,
		// so we'll need to create them before creating the symlink
		const dir = path.dirname(dest);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		try {
			fs.symlinkSync(options.path, dest, 'dir');
		} catch (error) {
			// Windows requires admin privileges for symlinks
			if (
				platform() === 'win32' &&
				common.isNodeError(error) &&
				(error.code === 'EPERM' || error.code === 'EACCES')
			) {
				// fall back to copying the directory
				copyDirectorySync(options.path, dest);
			} else {
				throw error;
			}
		}
	} else {
		const tarballUrl = pkg.dist?.tarball;
		if (!tarballUrl) {
			throw new Error(`Invalid add-on package: '${pkg.name}' is missing 'dist.tarball'`);
		}

		const data = await fetch(tarballUrl);
		if (!data.body) throw new Error(`Unexpected response: '${tarballUrl}' responded with no body`);

		await pipeline(
			data.body,
			createGunzip(),
			// file paths from the tarball will always have a `package/` prefix,
			// so we'll need to strip that out
			unpackTar(dest, { strip: 1 })
		);
	}

	return await importAddonCode(pkg.name, pkg.version, pkg.exports);
}

export async function importAddonCode(
	pkgName: string,
	pkgVersion: string,
	exports?: common.PackageJSON['exports']
): Promise<AddonDefinition> {
	const issues: string[] = [];
	let unresolvedModule = false;

	// only probe `/sv` when the package actually maps it, otherwise the probe itself
	// fails and reports a missing module that the author never declared
	const candidates = hasSvExport(exports) ? [`${pkgName}/sv`, pkgName] : [pkgName];

	for (const specifier of candidates) {
		try {
			const details: AddonDefinition | undefined = (await import(specifier)).default;
			if (details) return details;

			issues.push(`'${specifier}' resolved but has no default export`);
		} catch (e) {
			// ESM entry points report `ERR_MODULE_NOT_FOUND`, CJS ones report `MODULE_NOT_FOUND`
			if (
				common.isNodeError(e) &&
				(e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'MODULE_NOT_FOUND')
			) {
				unresolvedModule = true;
			}
			issues.push(`'${specifier}' failed to load: ${e instanceof Error ? e.message : e}`);
		}
	}

	const hint = unresolvedModule
		? `\nThis usually means the add-on has dependencies that are not bundled.\n`
		: '';

	throw new Error(
		`Failed to load add-on '${pkgName}@${pkgVersion}':\n- ${issues.join('\n- ')}\n${hint}\n` +
			`Please report this to the add-on author.`
	);
}

/** `exports` is only consulted to pick entry points, never to reject a package. */
export function hasSvExport(exports?: common.PackageJSON['exports']): boolean {
	if (typeof exports !== 'object' || exports === null || Array.isArray(exports)) return false;
	return Boolean(exports['./sv']);
}

export async function getPackageJSON(ref: AddonReference): Promise<{
	pkg: PackageJSON;
	repo: string;
	path?: string;
	warning?: string;
}> {
	const { specifier, source } = ref;

	if (source.kind === 'official') {
		throw new Error(`Unexpected official addon in non-official getPackageJSON(): ${specifier}`);
	}

	if (source.kind === 'file') {
		const pkgJSONPath = path.resolve(source.path, 'package.json');
		const json = fs.readFileSync(pkgJSONPath, 'utf8');
		const pkg = parsePackageJSON(JSON.parse(json), specifier);
		const warning = verifyPackage(pkg, specifier);

		return { path: source.path, pkg, repo: source.path, warning };
	}

	// Check blocklist
	const blocklist: PackageBlocklist = await downloadJson(
		'https://raw.githubusercontent.com/sveltejs/cli/refs/heads/main/packages/sv/blocklist.json'
	);
	if (blocklist.npm_names.includes(source.packageName)) {
		common.errorAndExit(
			`${color.warning(source.packageName)} blocked from being installed. If this is not the intended behavior please open an issue here: https://github.com/sveltejs/cli/issues.`
		);
	}

	const pkg = parsePackageJSON(await downloadJson(source.registryUrl), specifier);
	const warning = verifyPackage(pkg, specifier);
	const repo =
		typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? source.npmUrl);

	return { pkg, repo, warning };
}
