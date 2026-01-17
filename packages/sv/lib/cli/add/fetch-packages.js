/** @import { ResolvedAddon } from '../../core.js' */
import * as p from '@clack/prompts';
import fs from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-fs';

import pkg from '../../../package.json' with { type: 'json' };
import { color } from '../../core.js';
import * as common from '../utils/common.js';
// eslint-disable-next-line no-restricted-imports
import { splitVersion } from '../../core/common.js';
// eslint-disable-next-line no-restricted-imports
import { downloadJson } from '../../core/downloadJson.js';

// path to the `node_modules` directory of `sv`
const NODE_MODULES = fileURLToPath(new URL('../node_modules', import.meta.url));
const REGISTRY = 'https://registry.npmjs.org';
export const Directive = { file: 'file:', npm: 'npm:' };

/**
 * @param {Record<string, any>} addonPkg
 * @param {string} specifier
 */
function verifyPackage(addonPkg, specifier) {
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
		p.log.warn(
			`${color.warning(specifier)} was built for ${color.warning(`sv@${addon_major}.x`)} but you're running ${color.warning(`sv@${pkg.version}`)}.\n` +
				`This may cause compatibility issues.`
		);
	}
}

/**
 * Recursively copies a directory from source to destination
 * Skips node_modules directories
 * @param {string} src
 * @param {string} dest
 */
function copyDirectorySync(src, dest) {
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

/**
 * @typedef {{ path?: string; pkg: any }} DownloadOptions
 */

/**
 * Downloads and installs the package into the `node_modules` of `sv`.
 * @param {DownloadOptions} options
 * @returns {Promise<ResolvedAddon>} the details of the downloaded addon
 */
export async function downloadPackage(options) {
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
		} catch (error) {
			// On Windows, symlinks may fail with EPERM if admin privileges aren't available
			// In that case, fall back to copying the directory
			if (
				platform() === 'win32' &&
				// @ts-expect-error
				(error.code === 'EPERM' || error.code === 'EACCES')
			) {
				copyDirectorySync(options.path, dest);
			} else {
				throw error;
			}
		}

		return await importAddonCode(pkg.name);
	}

	/** @type {string} */
	const tarballUrl = pkg.dist.tarball;

	const data = await fetch(tarballUrl);
	if (!data.body) throw new Error(`Unexpected response: '${tarballUrl}' responded with no body`);

	// extracts the package's contents from the tarball and writes the files to `sv/node_modules/pkg-name`
	// so that we can dynamically import the package via `import(pkg-name)`
	await pipeline(
		data.body,
		createGunzip(),
		extract(NODE_MODULES, {
			map: (/** @type {any} */ header) => {
				// file paths from the tarball will always have a `package/` prefix,
				// so we'll need to replace it with the name of the package
				header.name = header.name.replace('package', pkg.name);
				return header;
			}
		})
	);

	return await importAddonCode(pkg.name);
}

/**
 * @param {string} pkgName
 * @returns {Promise<ResolvedAddon>}
 */
async function importAddonCode(pkgName) {
	try {
		const { default: details } = await import(`${pkgName}/sv`);
		return details;
	} catch {
		// /sv export doesn't exist, fall through to default
	}
	const { default: details } = await import(pkgName);
	return details;
}

/**
 * @typedef {{
 *   name: string;
 *   version: string;
 *   [key: string]: string | number | boolean;
 * }} PackageJSON
 */

/**
 * @typedef {{ packageName: string; cwd: string }} GetPackageJSONOptions
 */

/**
 * @param {GetPackageJSONOptions} options
 * @returns {Promise<{ pkg: PackageJSON; repo: string; path?: string }>}
 */
export async function getPackageJSON({ cwd, packageName }) {
	let npm = packageName;
	if (packageName.startsWith(Directive.file)) {
		const pkgPath = path.resolve(cwd, packageName.slice(Directive.file.length));
		const pkgJSONPath = path.resolve(pkgPath, 'package.json');
		const json = fs.readFileSync(pkgJSONPath, 'utf8');
		const pkg = JSON.parse(json);
		verifyPackage(pkg, packageName);

		return { path: pkgPath, pkg, repo: pkgPath };
	}
	if (packageName.startsWith(Directive.npm)) {
		npm = packageName.slice(Directive.npm.length);
	}

	const pkg = await fetchPackageJSON(npm);
	verifyPackage(pkg, packageName);

	return {
		pkg,
		// fallback to providing the npm package URL
		repo: pkg.repository?.url ?? `https://www.npmjs.com/package/${npm}`
	};
}

/**
 * @param {string} packageName
 * @returns {Promise<any>}
 */
async function fetchPackageJSON(packageName) {
	let pkgName = packageName;
	let scope = '';
	if (packageName.startsWith('@')) {
		if (packageName.includes('/')) {
			const [org, name] = pkgName.split('/', 2);
			scope = `${org}/`;
			pkgName = name;
		} else {
			scope = `${packageName}/`;
			pkgName = 'sv';
		}
	}

	const [name, tag = 'latest'] = pkgName.split('@');
	const fullName = `${scope + name}`;
	const pkgUrl = `${REGISTRY}/${fullName}/${tag}`;

	const blocklist = await downloadJson(
		'https://raw.githubusercontent.com/sveltejs/cli/refs/heads/main/packages/sv/blocklist.json'
	);
	const blockedNpmAddons = blocklist.npm_names.includes(fullName);
	if (blockedNpmAddons)
		common.errorAndExit(
			`${color.warning(fullName)} blocked from being installed. If this is not the intended behavior please open an issue here: https://github.com/sveltejs/cli/issues.`
		);

	return await downloadJson(pkgUrl);
}
