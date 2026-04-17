import { color, downloadJson, splitVersion } from '@sveltejs/sv-utils';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-fs';
import pkg from '../../package.json' with { type: 'json' };
import * as common from './common.ts';
import type { AddonDefinition, AddonReference } from './config.ts';

// path to the `node_modules` directory of `sv`
const NODE_MODULES = fileURLToPath(new URL('../../node_modules', import.meta.url));

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
	const cleanedAddonVersion = addonSvVersion.replace(/^[\^~>=<]+/, '');
	const addon_major = splitVersion(cleanedAddonVersion).major;
	const sv_major = splitVersion(pkg.version).major;

	if (sv_major !== addon_major) {
		return (
			`${color.addon(specifier)} was built for ${color.warning(`sv@${cleanedAddonVersion}`)} but you're running ${color.addon(`sv@${pkg.version}`)}.\n` +
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

type DownloadOptions = { path?: string; pkg: any };
/**
 * Downloads and installs the package into the `node_modules` of `sv`.
 * @returns the details of the downloaded addon
 */
export async function downloadPackage(options: DownloadOptions): Promise<AddonDefinition> {
	const { pkg } = options;
	if (options.path) {
		// we'll create a symlink so that we can dynamically import the package via `import(pkg-name)`
		// On Windows, symlinks require admin privileges, so we fall back to copying if symlink fails
		const dest = path.join(NODE_MODULES, pkg.name.split('/').join(path.sep));

		// ensures that a new symlink/copy is always created
		if (fs.existsSync(dest)) {
			fs.rmSync(dest, { recursive: true });
		}

		// `symlinkSync` doesn't recursively create directories to the `destination` path,
		// so we'll need to create them before creating the symlink
		const dir = path.dirname(dest);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Try to create a symlink, but fall back to copying on Windows if it fails with EPERM
		try {
			fs.symlinkSync(options.path, dest, 'dir');
		} catch (error: any) {
			// On Windows, symlinks may fail with EPERM if admin privileges aren't available
			// In that case, fall back to copying the directory
			if (platform() === 'win32' && (error.code === 'EPERM' || error.code === 'EACCES')) {
				copyDirectorySync(options.path, dest);
			} else {
				throw error;
			}
		}

		return await importAddonCode(pkg.name, pkg.version);
	}

	const tarballUrl: string = pkg.dist.tarball;

	const data = await fetch(tarballUrl);
	if (!data.body) throw new Error(`Unexpected response: '${tarballUrl}' responded with no body`);

	// extracts the package's contents from the tarball and writes the files to `sv/node_modules/pkg-name`
	// so that we can dynamically import the package via `import(pkg-name)`
	await pipeline(
		data.body,
		createGunzip(),
		extract(NODE_MODULES, {
			map: (header: any) => {
				// file paths from the tarball will always have a `package/` prefix,
				// so we'll need to replace it with the name of the package
				header.name = header.name.replace('package', pkg.name);
				return header;
			}
		})
	);

	return await importAddonCode(pkg.name, pkg.version);
}

async function importAddonCode(pkgName: string, pkgVersion: string): Promise<AddonDefinition> {
	const issues: string[] = [];

	let details: AddonDefinition | undefined;
	try {
		({ default: details } = await import(`${pkgName}/sv`));
	} catch {
		issues.push(`'/sv' export not found`);
	}

	if (!details) {
		try {
			({ default: details } = await import(pkgName));
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

export type DiscoveredAddonSource = 'local' | 'global';

export type CommunityAddonInfo = {
	name: string;
	description: string;
	homepage: string;
	source: DiscoveredAddonSource;
};

/**
 * Discovers community addons from local and global node_modules.
 * Scans for packages with `sv-add` keyword and `sv` in peerDependencies.
 */
export function discoverCommunityAddons(cwd: string): CommunityAddonInfo[] {
	const local = scanNodeModules(path.join(cwd, 'node_modules'), 'local');

	let global: CommunityAddonInfo[] = [];
	try {
		const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
		global = scanNodeModules(globalRoot, 'global');
	} catch {
		// silently ignore if npm root -g fails
	}

	// deduplicate: local wins over global
	const byName = new Map<string, CommunityAddonInfo>();
	for (const addon of [...global, ...local]) {
		byName.set(addon.name, addon);
	}
	return Array.from(byName.values());
}

function scanNodeModules(
	nodeModulesPath: string,
	source: DiscoveredAddonSource
): CommunityAddonInfo[] {
	if (!fs.existsSync(nodeModulesPath)) return [];

	const results: CommunityAddonInfo[] = [];
	for (const entry of fs.readdirSync(nodeModulesPath, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		if (entry.name.startsWith('@')) {
			const scopePath = path.join(nodeModulesPath, entry.name);
			for (const scoped of fs.readdirSync(scopePath, { withFileTypes: true })) {
				if (!scoped.isDirectory()) continue;
				const info = readCommunityAddon(path.join(scopePath, scoped.name), source);
				if (info) results.push(info);
			}
		} else {
			const info = readCommunityAddon(path.join(nodeModulesPath, entry.name), source);
			if (info) results.push(info);
		}
	}
	return results;
}

function readCommunityAddon(
	pkgDir: string,
	source: DiscoveredAddonSource
): CommunityAddonInfo | undefined {
	try {
		const raw = fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8');
		const pkg = JSON.parse(raw);

		if (!pkg.keywords?.includes('sv-add')) return;
		if (!pkg.peerDependencies?.sv) return;

		return {
			name: pkg.name,
			description: pkg.description ?? '',
			homepage: pkg.homepage ?? pkg.repository?.homepage ?? pkg.repository?.url ?? '',
			source
		};
	} catch {
		return;
	}
}
