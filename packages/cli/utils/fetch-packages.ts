import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-fs';
import { fileURLToPath } from 'node:url';
import type { AdderWithoutExplicitArgs } from '@svelte-cli/core';

// path to the `node_modules` directory of `sv`
const NODE_MODULES = path.join(fileURLToPath(import.meta.url), '..', '..', 'node_modules');
const REGISTRY = 'https://registry.npmjs.org';
export const Directive = { file: 'file:', npm: 'npm:' };

function verifyPackage(pkg: Record<string, any>, specifier: string) {
	const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
	// valid adders should always have a dependency on `core`
	if (!deps['@svelte-cli/core']) {
		throw new Error(
			`Invalid adder package specified: '${specifier}' is missing a dependency on '@svelte-cli/core' in its 'package.json'`
		);
	}
	// adders should never have any external dependencies outside of `core`.
	// if the adder does have an external dependency, then we'll throw a helpful error guiding them to the solution
	for (const dep of Object.keys(deps)) {
		if (dep === '@svelte-cli/core') continue;
		throw new Error(
			`Invalid adder package detected: '${specifier}'\nCommunity adders should not have any external 'dependencies' besides '@svelte-cli/core'. Consider bundling your dependencies if they are necessary`
		);
	}
}

type DownloadOptions = { packageName: string; cwd: string };

/**
 * Downloads and installs the package into the `node_modules` of `sv`.
 * @returns the details of the downloaded adder
 */
export async function downloadPackage({
	cwd,
	packageName
}: DownloadOptions): Promise<AdderWithoutExplicitArgs> {
	let npm = packageName;
	if (packageName.startsWith(Directive.file)) {
		const pkgPath = path.resolve(cwd, packageName.slice(Directive.file.length));
		const pkgJSONPath = path.resolve(pkgPath, 'package.json');
		const json = fs.readFileSync(pkgJSONPath, 'utf8');
		const pkg = JSON.parse(json);
		verifyPackage(pkg, packageName);

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
		fs.symlinkSync(pkgPath, dest);

		const { default: details } = await import(pkg.name);
		return details;
	}
	if (packageName.startsWith(Directive.npm)) {
		npm = packageName.slice(Directive.npm.length);
	}

	const pkg = await fetchPackageJSON(npm);
	verifyPackage(pkg, packageName);

	const tarballUrl: string = pkg.dist.tarball;
	const data = await fetch(tarballUrl);
	if (!data.body)
		throw new Error(`Unexpected response: Tarball request for '${npm}' responded with no body`);

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

async function fetchPackageJSON(packageName: string): Promise<Record<string, any>> {
	let pkgName = packageName;
	let scope = '';
	if (packageName.startsWith('@')) {
		const [org, name] = pkgName.split('/', 2);
		scope = `${org}/`;
		pkgName = name;
	}

	const [name, tag = 'latest'] = pkgName.split('@');
	const pkgUrl = `${REGISTRY}/${scope + name}/${tag}`;
	const resp = await fetch(pkgUrl);
	if (resp.status >= 200 && resp.status < 300) {
		return await resp.json();
	}
	if (resp.status === 404) {
		throw new Error(`Specified package '${packageName}' doesn't exist in the registry: ${pkgUrl}`);
	}

	throw new Error(`Failed to fetch ${pkgUrl} - GET ${resp.status}`);
}
