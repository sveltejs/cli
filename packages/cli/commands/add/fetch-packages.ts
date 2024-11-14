import fs from 'node:fs';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { extract } from 'tar-fs';
import type { AddonWithoutExplicitArgs } from '@sveltejs/cli-core';

// path to the `node_modules` directory of `sv`
const NODE_MODULES = fileURLToPath(new URL('../node_modules', import.meta.url));
const REGISTRY = 'https://registry.npmjs.org';
export const Directive = { file: 'file:', npm: 'npm:' };

function verifyPackage(pkg: Record<string, any>, specifier: string) {
	const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
	// valid addons should always have a dependency on `core`
	if (!deps['@sveltejs/cli-core']) {
		throw new Error(
			`Invalid add-on package specified: '${specifier}' is missing a dependency on '@sveltejs/cli-core' in its 'package.json'`
		);
	}
	// addons should never have any external dependencies outside of `core`.
	// if the addon does have an external dependency, then we'll throw a helpful error guiding them to the solution
	for (const dep of Object.keys(deps)) {
		if (dep === '@sveltejs/cli-core') continue;
		throw new Error(
			`Invalid add-on package detected: '${specifier}'\nCommunity addons should not have any external 'dependencies' besides '@sveltejs/cli-core'. Consider bundling your dependencies if they are necessary`
		);
	}
}

type DownloadOptions = { path?: string; pkg: any };
/**
 * Downloads and installs the package into the `node_modules` of `sv`.
 * @returns the details of the downloaded addon
 */
export async function downloadPackage(options: DownloadOptions): Promise<AddonWithoutExplicitArgs> {
	const { pkg } = options;
	if (options.path) {
		// we'll create a symlink so that we can dynamically import the package via `import(pkg-name)`
		const dest = path.join(NODE_MODULES, pkg.name.split('/').join(path.sep));

		// ensures that a new symlink is always created
		if (fs.existsSync(dest)) {
			fs.rmSync(dest);
		}

		// `symlinkSync` doesn't recursively create directories to the `destination` path,
		// so we'll need to create them before creating the symlink
		const dir = path.dirname(dest);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.symlinkSync(options.path, dest);

		const { default: details } = await import(pkg.name);
		return details;
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
			map: (header) => {
				// file paths from the tarball will always have a `package/` prefix,
				// so we'll need to replace it with the name of the package
				header.name = header.name.replace('package', pkg.name);
				return header;
			}
		})
	);

	const { default: details } = await import(pkg.name);
	return details;
}

type PackageJSON = {
	name: string;
	version: string;
	[key: string]: string | number | boolean;
};
type GetPackageJSONOptions = { packageName: string; cwd: string };
export async function getPackageJSON({ cwd, packageName }: GetPackageJSONOptions): Promise<{
	pkg: PackageJSON;
	repo: string;
	path?: string;
}> {
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
		// fallback to providing the NPM package URL
		repo: pkg.repository?.url ?? `https://www.npmjs.com/package/${npm}`
	};
}

async function fetchPackageJSON(packageName: string) {
	let pkgName = packageName;
	let scope = '';
	if (packageName.startsWith('@')) {
		const [org, name] = pkgName.split('/', 2);
		scope = `${org}/`;
		pkgName = name!;
	}

	const [name, tag = 'latest'] = pkgName.split('@');
	const pkgUrl = `${REGISTRY}/${scope + name}/${tag}`;
	const resp = await fetch(pkgUrl);
	if (resp.status === 404) {
		throw new Error(`Package '${packageName}' doesn't exist in the registry: '${pkgUrl}'`);
	}
	if (resp.status < 200 && resp.status >= 300) {
		throw new Error(`Failed to fetch '${pkgUrl}' - GET ${resp.status}`);
	}

	return await resp.json();
}
