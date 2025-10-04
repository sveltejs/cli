import fs from 'node:fs';
import path from 'node:path';
import * as js from '@sveltejs/cli-core/js';
import { parseJson, parseScript, parseSvelte } from '@sveltejs/cli-core/parsers';
import { isVersionUnsupportedBelow } from '@sveltejs/cli-core';

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

	// add playground layout to lib
	{
		const playgroundLayoutPath = path.join(cwd, 'src', 'lib', 'PlaygroundLayout.svelte');
		const { generateCode } = parseSvelte('');
		const newContent = generateCode({
			script: `import favicon from "$lib/assets/favicon.svg";
  
  let { children } = $props();

  const title = "${playground.name}";
  const href = "${url}";

  let prefersDark = $state(true);
  let isDark = $state(true);

  function setTheme(value) {
    isDark = value === "dark";
    localStorage.setItem("sv:theme", isDark === prefersDark ? "system" : value);
  }

  $effect(() => {
    document.documentElement.classList.remove("light", "dark");

    prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = localStorage.getItem("sv:theme") 
    isDark = theme === "dark" || (theme === "system" && prefersDark);

    document.documentElement.classList.add(isDark ? "dark" : "light");
  });`,
			template: `<svelte:head>
  <title>--from-playground {title}</title>
  <script>
    {
      const theme = localStorage.getItem("sv:theme");

      document.documentElement.classList.add(
        !theme || theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme
      );
    }
  </script>
</svelte:head>

<div class="layout">
  <nav class="navbar">
    <div class="nav-left">
      <a href="/" class="svelte-icon">
        <img src={favicon} alt="Svelte" width="32" height="32" />
      </a>
      <p class="title">{title}</p>
    </div>
    <div class="nav-right">
      <a {href} class="raised" target="_blank" rel="noopener noreferrer">
        --to-playground
        <span aria-hidden="true" style="margin-left:0.25em;"> ↗</span>
      </a>
      <button
        class="raised theme-toggle"
        onclick={() => setTheme(isDark ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <span class="icon"></span>
      </button>
    </div>
  </nav>

  <main class="content">
    {@render children?.()}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
  }

  :global(html) {
    margin: 0;
    --bg-1: hsl(0, 0%, 100%);
    --bg-2: hsl(206, 20%, 90%);
    --bg-3: hsl(206, 20%, 80%);
    --navbar-bg: #fff;
    --fg-1: hsl(0, 0%, 13%);
    --fg-2: hsl(0, 0%, 50%);
    --fg-3: hsl(0, 0%, 60%);
    --link: hsl(208, 77%, 47%);
    --border-radius: 4px;
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    color-scheme: light;
    background: var(--bg-1);
    color: var(--fg-1);
    font-family: var(--font);
    line-height: 1.5;
    height: calc(100vh - 2rem);
    accent-color: var(--link) !important;
    min-height: 100vh;
    background-color: var(--bg-1);
  }

  :global(html.dark) {
    color-scheme: dark;
    --bg-1: hsl(0, 0%, 18%);
    --bg-2: hsl(0, 0%, 30%);
    --bg-3: hsl(0, 0%, 40%);
    --navbar-bg: hsl(220, 14%, 16%);
    --fg-1: hsl(0, 0%, 75%);
    --fg-2: hsl(0, 0%, 40%);
    --fg-3: hsl(0, 0%, 30%);
    --link: hsl(206, 96%, 72%);
  }

  .navbar {
    color: var(--fg-1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0em 2.5rem;
    height: 3.7rem;
    background-color: var(--navbar-bg);
    box-shadow:
      0 2px 8px 0 rgba(0, 0, 0, 0.08),
      0 1.5px 4px 0 rgba(0, 0, 0, 0.04);
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .svelte-icon {
    display: flex;
    align-items: center;
    text-decoration: none;
    transition: opacity 0.2s ease;
  }

  .svelte-icon:hover {
    opacity: 0.8;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 400;
    margin: 0;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .raised {
    background: var(--navbar-bg);
    border-left: 0.5px solid var(--fg-3);
    border-top: 0.5px solid var(--fg-3);
    border-bottom: none;
    border-right: none;
    border-radius: var(--border-radius);
    color: var(--fg-1);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      0 1px 2px rgba(0, 0, 0, 0.06);
    text-decoration: none;
    font-weight: 500;
    padding: 0.25rem 0.75rem;
    font-size: 0.8rem;
  }

  .raised:hover {
    border-left-color: var(--fg-2);
    border-top-color: var(--fg-2);
    box-shadow:
      0 4px 8px rgba(0, 0, 0, 0.15),
      0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translate(-1px, -1px);
  }

  .content {
    padding: 1rem;
    color: var(--fg-1);
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.8rem;
    height: 1.8rem;
    padding: 0;
    min-width: 2rem;
  }

  .icon {
    display: inline-block;
    width: 1.5rem;
    height: 1.5rem;
    -webkit-mask-size: 1.5rem;
    mask-size: 1.5rem;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    background-color: var(--fg-1);
  }

  .icon {
    mask-image: url('data:image/svg+xml,%3csvg%20xmlns="http://www.w3.org/2000/svg"%20viewBox="0%200%2024%2024"%3e%3cpath%20fill="%23666"%20d="M12%2021q-3.775%200-6.388-2.613T3%2012q0-3.45%202.25-5.988T11%203.05q.625-.075.975.45t-.025%201.1q-.425.65-.638%201.375T11.1%207.5q0%202.25%201.575%203.825T16.5%2012.9q.775%200%201.538-.225t1.362-.625q.525-.35%201.075-.037t.475.987q-.35%203.45-2.937%205.725T12%2021Zm0-2q2.2%200%203.95-1.213t2.55-3.162q-.5.125-1%20.2t-1%20.075q-3.075%200-5.238-2.163T9.1%207.5q0-.5.075-1t.2-1q-1.95.8-3.163%202.55T5%2012q0%202.9%202.05%204.95T12%2019Zm-.25-6.75Z"/%3e%3c/svg%3e');
  }

  :global(html.dark) .icon {
    mask-image: url("data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%3e%3cpath%20fill='%23d4d4d4'%20d='M12%2019a1%201%200%200%201%20.993.883L13%2020v1a1%201%200%200%201-1.993.117L11%2021v-1a1%201%200%200%201%201-1zm6.313-2.09.094.083.7.7a1%201%200%200%201-1.32%201.497l-.094-.083-.7-.7a1%201%200%200%201%201.218-1.567l.102.07zm-11.306.083a1%201%200%200%201%20.083%201.32l-.083.094-.7.7a1%201%200%200%201-1.497-1.32l.083-.094.7-.7a1%201%200%200%201%201.414%200zM4%2011a1%201%200%200%201%20.117%201.993L4%2013H3a1%201%200%200%201-.117-1.993L3%2011h1zm17%200a1%201%200%200%201%20.117%201.993L21%2013h-1a1%201%200%200%201-.117-1.993L20%2011h1zM6.213%204.81l.094.083.7.7a1%201%200%200%201-1.32%201.497l-.094-.083-.7-.7A1%201%200%200%201%206.11%204.74l.102.07zm12.894.083a1%201%200%200%201%20.083%201.32l-.083.094-.7.7a1%201%200%200%201-1.497-1.32l.083-.094.7-.7a1%201%200%200%201%201.414%200zM12%202a1%201%200%200%201%20.993.883L13%203v1a1%201%200%200%201-1.993.117L11%204V3a1%201%200%200%201%201-1zm0%205a5%205%200%201%201-4.995%205.217L7%2012l.005-.217A5%205%200%200%201%2012%207z'/%3e%3c/svg%3e");
  }
</style>`
		});
		fs.writeFileSync(playgroundLayoutPath, newContent, 'utf-8');
	}

	// add app import to +page.svelte
	const filePath = path.join(cwd, 'src/routes/+page.svelte');
	const content = fs.readFileSync(filePath, 'utf-8');
	const { script, generateCode } = parseSvelte(content);
	js.imports.addDefault(script.ast, { as: 'App', from: `$lib/playground/${mainFile.name}` });
	js.imports.addDefault(script.ast, {
		as: 'PlaygroundLayout',
		from: `$lib/PlaygroundLayout.svelte`
	});
	const newContent = generateCode({
		script: script.generateCode(),
		template: `<PlaygroundLayout>
	<App />
</PlaygroundLayout>`
	});
	fs.writeFileSync(filePath, newContent, 'utf-8');

	// add packages as dependencies to package.json if requested
	const pkgPath = path.join(cwd, 'package.json');
	const pkgSource = fs.readFileSync(pkgPath, 'utf-8');
	const pkgJson = parseJson(pkgSource);
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
		const { ast, generateCode } = parseScript(svelteConfig);
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
