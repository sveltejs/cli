import fs from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-fs';
import pkg from '../../../package.json' with { type: 'json' };
import { color, type AddonDefinition, type AddonReference } from '../../core.ts';
// eslint-disable-next-line no-restricted-imports
import { splitVersion } from '../../core/common.ts';
// eslint-disable-next-line no-restricted-imports
import { downloadJson } from '../../core/downloadJson.ts';
import * as common from '../utils/common.ts';

// path to the `node_modules` directory of `sv`
const NODE_MODULES = fileURLToPath(new URL('../node_modules', import.meta.url));

function verifyPackage(addonPkg: Record<string, any>, specifier: string): string | undefined {
	// We should look only for dependencies, not devDependencies or peerDependencies
	const deps = { ...addonPkg.dependencies };

	// valid addons should always have a dependency on `sv`
	const addonSvVersion = deps['sv'];
	if (!addonSvVersion) {
		throw new Error(
			`Invalid add-on package specified: '${specifier}' is missing a dependency on 'sv' in its 'package.json'`
		);
	}

	// addons should never have any external dependencies outside of `sv`
	for (const dep of Object.keys(deps)) {
		if (dep === 'sv') continue;
		throw new Error(
			`Invalid add-on package detected: '${specifier}'\nCommunity addons should not have any external 'dependencies' besides 'sv'. Consider bundling your dependencies if they are necessary`
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

		return await importAddonCode(pkg.name);
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

	return await importAddonCode(pkg.name);
}

async function importAddonCode(pkgName: string): Promise<AddonDefinition> {
	try {
		const { default: details } = await import(`${pkgName}/sv`);
		return details;
	} catch {
		// /sv export doesn't exist, fall through to default
	}
	const { default: details } = await import(pkgName);
	return details;
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
