import { color, coerceVersion, downloadJson } from '@sveltejs/sv-utils';
import { unpackTar } from 'modern-tar/fs';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGunzip } from 'node:zlib';
import pkg from '../../package.json' with { type: 'json' };
import * as common from './common.ts';
import type { AddonDefinition, AddonReference } from './config.ts';

/** Re-exports `import()` so add-ons are resolved from their install root, not from `sv`'s. */
const LOADER = 'loader.mjs';
const LOADER_SOURCE = 'export const load = (id) => import(id);\n';

const SV_ROOT = findSvRoot();

/**
 * Add-ons are installed under the user's cache dir rather than next to `sv`: with `pnpm dlx`,
 * `sv` lives in the content store, which is immutable, shared by every project and never pruned
 * per-project.
 */
const CACHE_DIR = path.join(cacheHome(), 'sv', 'add-ons', pkg.version);

/** Walks up from this module, which sits in `src/core/` in the repo and in `dist/` once published. */
function findSvRoot(): string {
	let dir = path.dirname(fileURLToPath(import.meta.url));
	for (let parent = path.dirname(dir); parent !== dir; dir = parent, parent = path.dirname(dir)) {
		const manifest = path.join(dir, 'package.json');
		if (!fs.existsSync(manifest)) continue;
		if (JSON.parse(fs.readFileSync(manifest, 'utf8')).name === pkg.name) return dir;
	}
	throw new Error(`Unable to locate the installation directory of '${pkg.name}'`);
}

function cacheHome(): string {
	if (process.platform === 'win32' && process.env.LOCALAPPDATA) return process.env.LOCALAPPDATA;
	if (process.env.XDG_CACHE_HOME) return process.env.XDG_CACHE_HOME;
	const home = os.homedir();
	if (!home) return os.tmpdir();
	return process.platform === 'darwin'
		? path.join(home, 'Library', 'Caches')
		: path.join(home, '.cache');
}

function verifyPackage(addonPkg: Record<string, any>, specifier: string): string | undefined {
	const peerDeps = { ...addonPkg.peerDependencies };
	const deps = { ...addonPkg.dependencies };

	// valid addons should always have `sv` as a peerDependency
	const addonSvVersion = peerDeps['sv'];
	if (!addonSvVersion) {
		throw new Error(
			`Invalid add-on package specified: '${specifier}' is missing 'sv' in its 'peerDependencies'`
		);
	}

	// addons should not have any dependencies (everything should be bundled)
	if (Object.keys(deps).length > 0) {
		throw new Error(
			`Invalid add-on package detected: '${specifier}'\nCommunity add-ons should not have any 'dependencies'. Use 'peerDependencies' for 'sv' and bundle everything else`
		);
	}

	// Check version compatibility and warn if there's a major version mismatch
	const addon = coerceVersion(addonSvVersion);
	const sv_major = coerceVersion(pkg.version).major;

	if (sv_major !== addon.major) {
		return (
			`${color.addon(specifier)} was built for ${color.warning(`sv@${addon.version ?? addonSvVersion}`)} but you're running ${color.addon(`sv@${pkg.version}`)}.\n` +
			`This may cause compatibility issues. ${color.optional('Run it with the same sv version to avoid issues.')}`
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

/** Creates a directory symlink, or a junction on Windows, where symlinks need admin privileges. */
function linkDir(target: string, dest: string) {
	fs.symlinkSync(target, dest, process.platform === 'win32' ? 'junction' : 'dir');
}

/** The add-on's install root: a `node_modules` holding the add-on itself, plus a loader stub. */
function installRoot(options: DownloadOptions): string {
	if (options.path) return path.join(CACHE_DIR, 'local', hashPath(options.path));
	const { name, version } = options.pkg;
	return path.join(CACHE_DIR, 'npm', `${name.split('/').join('+')}@${version}`);
}

function hashPath(target: string): string {
	return createHash('sha256').update(path.resolve(target)).digest('hex').slice(0, 16);
}

/**
 * A cached root is only usable while its `sv` link still points at the running `sv`, which is not
 * a given: the cache outlives reinstalls and `pnpm dlx` runs from a different store path.
 */
function isCached(root: string): boolean {
	try {
		return fs.realpathSync(path.join(root, 'node_modules', 'sv')) === fs.realpathSync(SV_ROOT);
	} catch {
		return false;
	}
}

/** Populates the install root in a temporary directory, then moves it into place in one step. */
async function install(root: string, name: string, write: (dest: string) => Promise<void> | void) {
	fs.mkdirSync(path.dirname(root), { recursive: true });
	const tmp = fs.mkdtempSync(`${root}.tmp-`);
	try {
		const dest = path.join(tmp, 'node_modules', ...name.split('/'));
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		await write(dest);

		// `sv` is the only dependency an add-on is allowed to leave unbundled
		linkDir(SV_ROOT, path.join(tmp, 'node_modules', 'sv'));
		fs.writeFileSync(path.join(tmp, LOADER), LOADER_SOURCE);

		fs.rmSync(root, { recursive: true, force: true });
		fs.renameSync(tmp, root);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

type DownloadOptions = { path?: string; pkg: any };
/**
 * Installs the package into `sv`'s add-on cache.
 * @returns the details of the downloaded addon
 */
export async function downloadPackage(options: DownloadOptions): Promise<AddonDefinition> {
	const { pkg } = options;
	const root = installRoot(options);
	const source = options.path;

	if (source) {
		// always relinked: unlike a published version, a local add-on changes in place
		await install(root, pkg.name, (dest) => {
			try {
				linkDir(source, dest);
			} catch (error: any) {
				// on Windows, linking may fail without admin privileges; copy instead
				if (process.platform !== 'win32' || (error.code !== 'EPERM' && error.code !== 'EACCES')) {
					throw error;
				}
				copyDirectorySync(source, dest);
			}
		});
	} else if (!isCached(root)) {
		const tarballUrl: string = pkg.dist.tarball;
		const data = await fetch(tarballUrl);
		if (!data.body) throw new Error(`Unexpected response: '${tarballUrl}' responded with no body`);

		await install(root, pkg.name, (dest) =>
			pipeline(
				data.body!,
				createGunzip(),
				// file paths from the tarball will always have a `package/` prefix,
				// so we'll need to replace it with the name of the package
				unpackTar(dest, { strip: 1 })
			)
		);
	}

	return await importAddonCode(root, pkg.name, pkg.version);
}

async function importAddonCode(
	root: string,
	pkgName: string,
	pkgVersion: string
): Promise<AddonDefinition> {
	const issues: string[] = [];
	const { load } = (await import(pathToFileURL(path.join(root, LOADER)).href)) as {
		load: (id: string) => Promise<{ default?: AddonDefinition }>;
	};

	let details: AddonDefinition | undefined;
	try {
		({ default: details } = await load(`${pkgName}/sv`));
	} catch {
		issues.push(`'/sv' export not found`);
	}

	if (!details) {
		try {
			({ default: details } = await load(pkgName));
		} catch {
			issues.push(`default export not found`);
		}
	}

	if (!details && issues.length > 0) {
		throw new Error(
			`Failed to load add-on '${pkgName}@${pkgVersion}':\n- ${issues.join('\n- ')}\n\n` +
				`Please report this to the add-on author.`
		);
	}

	return details!;
}

type PackageJSON = {
	name: string;
	version: string;
	[key: string]: string | number | boolean;
};
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
		const pkg = JSON.parse(json);
		const warning = verifyPackage(pkg, specifier);

		return { path: source.path, pkg, repo: source.path, warning };
	}

	// Check blocklist
	const blocklist = await downloadJson(
		'https://raw.githubusercontent.com/sveltejs/cli/refs/heads/main/packages/sv/blocklist.json'
	);
	if (blocklist.npm_names.includes(source.packageName)) {
		common.errorAndExit(
			`${color.warning(source.packageName)} blocked from being installed. If this is not the intended behavior please open an issue here: https://github.com/sveltejs/cli/issues.`
		);
	}

	const pkg = await downloadJson(source.registryUrl);
	const warning = verifyPackage(pkg, specifier);

	return {
		pkg,
		repo: pkg.repository?.url ?? source.npmUrl,
		warning
	};
}
