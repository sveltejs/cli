import fs from 'node:fs';
import path from 'node:path';
import * as js from '@sveltejs/cli-core/js';
import { parseJson, parseScript, parseSvelte } from '@sveltejs/cli-core/parsers';

export function validatePlaygroundUrl(link?: string): boolean {
	// If no link is provided, consider it invalid
	if (!link) return false;

	try {
		const url = new URL(link);
		if (url.hostname !== 'svelte.dev' || !url.pathname.startsWith('/playground/')) {
			return false;
		}

		const { playgroundId, hash } = parsePlaygroundUrl(link);
		return playgroundId !== undefined || hash !== undefined;
	} catch {
		// new Url() will throw if the URL is invalid
		return false;
	}
}

export function parsePlaygroundUrl(link: string): {
	playgroundId: string | undefined;
	hash: string | undefined;
} {
	const url = new URL(link);
	const [, playgroundId] = url.pathname.match(/\/playground\/([^/]+)/) || [];
	const hash = url.hash !== '' ? url.hash.slice(1) : undefined;

	return { playgroundId, hash };
}

type PlaygroundData = {
	name: string;
	files: Array<{ name: string; content: string }>;
};

export async function downloadPlaygroundData({
	playgroundId,
	hash
}: {
	playgroundId?: string;
	hash?: string;
}): Promise<PlaygroundData> {
	let data = [];
	// forked playgrounds have a playground_id and an optional hash.
	// usually the hash is more up to date so take the hash if present.
	if (hash) {
		data = JSON.parse(await decodeAndDecompressText(hash));
	} else {
		const response = await fetch(`https://svelte.dev/playground/api/${playgroundId}.json`);
		data = await response.json();
	}

	// saved playgrounds and playground hashes have a different structure
	// therefore we need to handle both cases.
	const files = data.components !== undefined ? data.components : data.files;
	return {
		name: data.name,
		files: files.map((file: { name: string; type: string; contents: string; source: string }) => {
			return {
				name: file.name + (file.type !== 'file' ? `.${file.type}` : ''),
				content: file.source || file.contents
			};
		})
	};
}

// Taken from https://github.com/sveltejs/svelte.dev/blob/ba7ad256f786aa5bc67eac3a58608f3f50b59e91/apps/svelte.dev/src/routes/(authed)/playground/%5Bid%5D/gzip.js#L19-L29
async function decodeAndDecompressText(input: string) {
	const decoded = atob(input.replaceAll('-', '+').replaceAll('_', '/'));
	// putting it directly into the blob gives a corrupted file
	const u8 = new Uint8Array(decoded.length);
	for (let i = 0; i < decoded.length; i++) {
		u8[i] = decoded.charCodeAt(i);
	}
	const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
	return new Response(stream).text();
}

/**
 * @returns A Map of packages with it's name as the key, and it's version as the value.
 */
export function detectPlaygroundDependencies(files: PlaygroundData['files']): Map<string, string> {
	const packages = new Map<string, string>();

	// Prefixes for packages that should be excluded (built-in or framework packages)
	const excludedPrefixes = [
		'$', // SvelteKit framework imports
		'node:', // Node.js built-in modules
		'svelte', // Svelte core packages
		'@sveltejs/' // All SvelteKit packages
	];

	for (const file of files) {
		let ast: js.AstTypes.Program | undefined;
		if (file.name.endsWith('.svelte')) {
			ast = parseSvelte(file.content).script.ast;
		} else if (file.name.endsWith('.js') || file.name.endsWith('.ts')) {
			ast = parseScript(file.content).ast;
		}
		if (!ast) continue;

		const imports = ast.body
			.filter((node): node is js.AstTypes.ImportDeclaration => node.type === 'ImportDeclaration')
			.map((node) => node.source.value as string)
			.filter((importPath) => !importPath.startsWith('./') && !importPath.startsWith('/'))
			.filter((importPath) => !excludedPrefixes.some((prefix) => importPath.startsWith(prefix)))
			.map(extractPackageInfo);

		imports.forEach(({ pkgName, version }) => packages.set(pkgName, version));
	}

	return packages;
}

/**
 * Extracts a package's name and it's versions from a provided import path.
 *
 * Handles imports with or without subpaths (e.g. `pkg-name/subpath`, `@org/pkg-name/subpath`)
 * as well as specified versions (e.g. pkg-name@1.2.3).
 */
function extractPackageInfo(importPath: string): { pkgName: string; version: string } {
	let pkgName = '';

	// handle scoped deps
	if (importPath.startsWith('@')) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [org, pkg, _subpath] = importPath.split('/', 3);
		pkgName = `${org}/${pkg}`;
	}

	if (!pkgName) {
		[pkgName] = importPath.split('/', 2);
	}

	const version = extractPackageVersion(pkgName);
	// strips the package's version from the name, if present
	if (version !== 'latest') pkgName = pkgName.replace(`@${version}`, '');
	return { pkgName, version };
}

function extractPackageVersion(pkgName: string) {
	let version = 'latest';
	// e.g. `pkg-name@1.2.3` (starting from index 1 to ignore the first `@` in scoped packages)
	if (pkgName.includes('@', 1)) {
		[, version] = pkgName.split('@');
	}
	return version;
}

export function setupPlaygroundProject(
	playground: PlaygroundData,
	cwd: string,
	installDependencies: boolean
): void {
	const mainFile = playground.files.find((file) => file.name === 'App.svelte');
	if (!mainFile) throw new Error('Failed to find `App.svelte` entrypoint.');

	const dependencies = detectPlaygroundDependencies(playground.files);
	for (const file of playground.files) {
		for (const [pkg, version] of dependencies) {
			// if a version was specified, we'll remove it from all import paths
			if (version !== 'latest') {
				file.content = file.content.replaceAll(`${pkg}@${version}`, pkg);
			}
		}

		// write file to disk
		const filePath = path.join(cwd, 'src', 'routes', file.name);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, file.content, 'utf8');
	}

	// add app import to +page.svelte
	const filePath = path.join(cwd, 'src/routes/+page.svelte');
	const content = fs.readFileSync(filePath, 'utf-8');
	const { script, generateCode } = parseSvelte(content);
	js.imports.addDefault(script.ast, { from: `./${mainFile.name}`, as: 'App' });
	const newContent = generateCode({ script: script.generateCode(), template: `<App />` });
	fs.writeFileSync(filePath, newContent, 'utf-8');

	// add packages as dependencies to package.json if requested
	if (installDependencies && dependencies.size >= 0) {
		const pkgPath = path.join(cwd, 'package.json');
		const pkgSource = fs.readFileSync(pkgPath, 'utf-8');
		const pkgJson = parseJson(pkgSource);
		pkgJson.data.dependencies ??= {};
		for (const [dep, version] of dependencies) {
			pkgJson.data.dependencies[dep] = version;
		}
		fs.writeFileSync(pkgPath, pkgJson.generateCode(), 'utf-8');
	}
}
