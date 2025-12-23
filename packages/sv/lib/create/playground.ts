import fs from 'node:fs';
import path from 'node:path';
import { walk } from 'zimmerframe';

import { isVersionUnsupportedBelow, js, parse, svelte } from '../core.ts';
import { getSharedFiles } from './utils.ts';
// eslint-disable-next-line no-restricted-imports
import { downloadJson } from '../core/downloadJson.ts';

export function validatePlaygroundUrl(link: string): boolean {
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

type PlaygroundURL = {
	playgroundId?: string;
	hash?: string;
	svelteVersion?: string;
};

export function parsePlaygroundUrl(link: string): PlaygroundURL {
	const url = new URL(link);
	const [, playgroundId] = url.pathname.match(/\/playground\/([^/]+)/) || [];
	const hash = url.hash !== '' ? url.hash.slice(1) : undefined;
	const svelteVersion = url.searchParams.get('version') || undefined;

	return { playgroundId, hash, svelteVersion };
}

type PlaygroundData = {
	name: string;
	files: Array<{ name: string; content: string }>;
	svelteVersion?: string;
};

export async function downloadPlaygroundData({
	playgroundId,
	hash,
	svelteVersion
}: PlaygroundURL): Promise<PlaygroundData> {
	let data = [];
	// forked playgrounds have a playground_id and an optional hash.
	// usually the hash is more up to date so take the hash if present.
	if (hash) {
		data = JSON.parse(await decodeAndDecompressText(hash));
	} else {
		data = await downloadJson(`https://svelte.dev/playground/api/${playgroundId}.json`);
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
		}),
		svelteVersion
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
			const { ast: svelteAst } = parse.svelte(file.content);
			ast = svelte.ensureScript(svelteAst);
		} else if (file.name.endsWith('.js') || file.name.endsWith('.ts')) {
			ast = parse.script(file.content).ast;
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
	url: string,
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
		const filePath = path.join(cwd, 'src', 'lib', 'playground', file.name);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, file.content, 'utf8');
	}

	// add playground shared files
	{
		const playgroundFiles = getSharedFiles().filter((file) => file.include.includes('playground'));

		for (const file of playgroundFiles) {
			let contentToWrite = file.contents;

			if (file.name === 'src/lib/PlaygroundLayout.svelte') {
				// getting raw content
				const { ast, generateCode } = parse.svelte(file.contents);
				// change title and url placeholders
				const scriptAst = svelte.ensureScript(ast);
				walk(scriptAst as js.AstTypes.Node, null, {
					Literal(node) {
						if (node.value === '$sv-title-$sv') {
							node.value = playground.name;
							node.raw = undefined;
						} else if (node.value === '$sv-url-$sv') {
							node.value = url;
							node.raw = undefined;
						}
					}
				});

				contentToWrite = generateCode();
			}

			fs.writeFileSync(path.join(cwd, file.name), contentToWrite, 'utf-8');
		}
	}

	// add app import to +page.svelte
	const filePath = path.join(cwd, 'src/routes/+page.svelte');
	const content = fs.readFileSync(filePath, 'utf-8');
	const { ast, generateCode } = parse.svelte(content);
	const scriptAst = svelte.ensureScript(ast);
	js.imports.addDefault(scriptAst, { as: 'App', from: `$lib/playground/${mainFile.name}` });
	js.imports.addDefault(scriptAst, {
		as: 'PlaygroundLayout',
		from: `$lib/PlaygroundLayout.svelte`
	});
	svelte.addFragment(
		ast,
		`<PlaygroundLayout>
		<App />
	</PlaygroundLayout>`
	);
	const newContent = generateCode();
	fs.writeFileSync(filePath, newContent, 'utf-8');

	// add packages as dependencies to package.json if requested
	const pkgPath = path.join(cwd, 'package.json');
	const pkgSource = fs.readFileSync(pkgPath, 'utf-8');
	const pkgJson = parse.json(pkgSource);
	let updatePackageJson = false;
	if (installDependencies && dependencies.size >= 0) {
		updatePackageJson = true;
		pkgJson.data.dependencies ??= {};
		for (const [dep, version] of dependencies) {
			pkgJson.data.dependencies[dep] = version;
		}
	}

	let experimentalAsyncNeeded = true;
	const addExperimentalAsync = () => {
		const svelteConfigPath = path.join(cwd, 'svelte.config.js');
		const svelteConfig = fs.readFileSync(svelteConfigPath, 'utf-8');
		const { ast, generateCode } = parse.script(svelteConfig);
		const { value: config } = js.exports.createDefault(ast, { fallback: js.object.create({}) });
		js.object.overrideProperties(config, { compilerOptions: { experimental: { async: true } } });
		fs.writeFileSync(svelteConfigPath, generateCode(), 'utf-8');
	};

	// we want to change the svelte version, even if the user decieded
	// to not install external dependencies
	if (playground.svelteVersion) {
		updatePackageJson = true;

		// from https://github.com/sveltejs/svelte.dev/blob/ba7ad256f786aa5bc67eac3a58608f3f50b59e91/packages/repl/src/lib/workers/npm.ts#L14
		const pkgPrNewRegex = /^(pr|commit|branch)-(.+)/;
		const match = pkgPrNewRegex.exec(playground.svelteVersion);
		const version = match ? `https://pkg.pr.new/svelte@${match[2]}` : `${playground.svelteVersion}`;
		pkgJson.data.devDependencies['svelte'] = version;

		// if the version is a "pkg.pr.new" version, we don't need to check for support, we will use the fallback
		if (!version.includes('pkg.pr.new')) {
			const unsupported = isVersionUnsupportedBelow(version, '5.36');
			if (unsupported) experimentalAsyncNeeded = false;
		}
	}

	if (experimentalAsyncNeeded) addExperimentalAsync();

	// only update the package.json if we made any changes
	if (updatePackageJson) fs.writeFileSync(pkgPath, pkgJson.generateCode(), 'utf-8');
}
