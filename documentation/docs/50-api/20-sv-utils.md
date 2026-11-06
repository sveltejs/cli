---
title: sv-utils
---

`@sveltejs/sv-utils` is an add-on utility for parsing, transforming, and generating code.

```sh
npm install -D @sveltejs/sv-utils
```

> [!NOTE]
> Bundle `@sveltejs/sv-utils` in your add-on to pin its version, or declare it in `peerDependencies` to use the copy `sv` ships. See [the trade-off](faq#Should-my-add-on-bundle-sveltejs-sv-utils).

## transforms

`transforms` is a collection of parser-aware functions that lets you modify the files via abstract syntax tree (AST). It accepts a callback function. The return value is designed to be be passed directly into `sv.file()`. The parser choice is baked into the transform type - you can't accidentally parse a vite config as Svelte because you never call a parser yourself.

Each transform injects relevant utilities into the callback, so you only need one import:

```js
import { transforms } from '@sveltejs/sv-utils';

transforms.script(/* ... */);
transforms.svelte(/* ... */);
// ...
```

### `transforms.script`

Transform a JavaScript/TypeScript file. The callback receives `{ ast, comments, content, js }`.

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';

sv.file(
	file.viteConfig,
	transforms.script(({ ast, js }) => {
		js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
		js.vite.addPlugin(ast, { code: 'foo()' });
	})
);
```

### `transforms.svelte`

Transform a Svelte component. The callback receives `{ ast, content, svelte, js }`.

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';

sv.file(
	layoutPath,
	transforms.svelte(({ ast, svelte }) => {
		svelte.addFragment(ast, '<Foo />');
	})
);
```

### `transforms.svelteScript`

Transform a Svelte component with a `<script>` block guaranteed. Pass `{ language }` as the first argument. The callback receives `{ ast, content, svelte, js }` where `ast.instance` is always non-null.

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';

sv.file(
	layoutPath,
	transforms.svelteScript({ language: 'ts' }, ({ ast, svelte, js }) => {
		js.imports.addDefault(ast.instance.content, { as: 'Foo', from: './Foo.svelte' });
		svelte.addFragment(ast, '<Foo />');
	})
);
```

### `transforms.css`

Transform a CSS file. The callback receives `{ ast, content, css }`.

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';

sv.file(
	file.stylesheet,
	transforms.css(({ ast, css }) => {
		css.addAtRule(ast, { name: 'import', params: "'tailwindcss'" });
	})
);
```

### `transforms.json`

Transform a JSON file. Mutate the `data` object directly. The callback receives `{ data, content, json }`.

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';

sv.file(
	file.typeConfig,
	transforms.json(({ data }) => {
		data.compilerOptions ??= {};
		data.compilerOptions.strict = true;
	})
);
```

### `transforms.yaml` / `transforms.toml`

Same pattern as `transforms.json`, for YAML and TOML files respectively. The callback receives `{ data, content }`.

### `transforms.text`

Transform a plain text file (.env, .gitignore, etc.). No parser - string in, string out. The callback receives `{ content, text }`.

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';

sv.file(
	'.env',
	transforms.text(({ content }) => {
		return content + '\nDATABASE_URL="file:local.db"';
	})
);
```

### Aborting a transform

Return `false` from any transform callback to abort - the original content is returned unchanged.

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';

sv.file(
	'eslint.config.js',
	transforms.script(({ ast, js }) => {
		const { value: existing } = js.exports.createDefault(ast, { fallback: myConfig });
		if (existing !== myConfig) {
			// config already exists, don't touch it
			return false;
		}
		// ... continue modifying ast
	})
);
```

### Standalone usage & testing

Transforms are curried functions - call them with the callback, then apply to content:

```js
import { transforms } from '@sveltejs/sv-utils';

const transform = transforms.script(({ ast, js }) => {
	js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
});
const result = transform('export default {}');
```

### Composability

For cases where you need to mix and match transforms and raw edits, use `sv.file` with a content callback and invoke the curried transform manually:

```js
// @noErrors
sv.file(path, (content) => {
	// curried
	const transform = transforms.script(({ ast, js }) => {
		js.imports.addDefault(ast, { as: 'foo', from: 'bar' });
	});

	// parser manipulation
	content = transform(content);

	// raw string manipulation
	content = content.replace('foo', 'baz');

	return content;
});
```

Add-ons can also export reusable transform functions:

```js
// @errors: 7006
import { transforms } from '@sveltejs/sv-utils';

// reusable - export from your package
export const addFooImport = transforms.svelte(({ ast, svelte, js }) => {
	svelte.ensureScript(ast, { language });
	js.imports.addDefault(ast.instance.content, { as: 'Foo', from: './Foo.svelte' });
});
```

```js
sv.file('+page.svelte', addFooImport);
sv.file('index.svelte', addFooImport);
```

## Parsers (low-level)

`transforms` will fit most users needs (e.g., conditional parsing, error handling around the parser). If not, `parse` is a low-level API available to you:

```js
// @noErrors
import { parse } from '@sveltejs/sv-utils';

const { ast, generateCode } = parse.script(content);
const { ast, generateCode } = parse.svelte(content);
const { ast, generateCode } = parse.css(content);
const { data, generateCode } = parse.json(content);
const { data, generateCode } = parse.yaml(content);
const { data, generateCode } = parse.toml(content);
const { ast, generateCode } = parse.html(content);
```

## Language tooling

Namespaced helpers for AST manipulation:

- **`js.*`** - imports, exports, objects, arrays, variables, functions, vite config helpers, SvelteKit helpers
- **`css.*`** - rules, declarations, at-rules, imports
- **`svelte.*`** - ensureScript, addSlot, addFragment
- **`json.*`** - arrayUpsert, packageScriptsUpsert
- **`html.*`** - attribute manipulation
- **`text.*`** - `add` (add if missing) or `set` lines in flat files (.env, .gitignore)

## Svelte config

The svelte/kit config can live in two places: passed straight to the `sveltekit()` plugin in `vite.config.{js,ts}`, or as a default export in a separate `svelte.config.{js,ts}`. Projects created by `sv` keep their config inside `vite.config.js` and ship no `svelte.config.js`.

`svelteConfig` lets add-ons read and edit that config wherever it lives - the `sveltekit()` argument in `vite.config.{js,ts}`, or a `svelte.config.{js,ts}` default export - without having to know which.

### `svelteConfig.edit`

You address options by name and the helper writes each one to the right place, so you never deal with the `kit` nesting yourself. Svelte-level options (`compilerOptions`, `preprocess`, `extensions`, `vitePlugin`) sit on the config object; everything else (`adapter`, `alias`, `files`, `typescript`, …) is a kit option, which means flattened onto the `sveltekit()` argument in a vite config, or nested under `kit` in a `svelte.config`.

```js
// @noErrors
import { svelteConfig } from '@sveltejs/sv-utils';

// inside an add-on's `run({ sv, cwd })`:
svelteConfig.edit({ sv, cwd }, ({ ast, property, override, js }) => {
	// svelte-level option - get-or-create its value, then mutate in place:
	js.array.append(property('extensions', { fallback: js.array.create() }), '.svx');

	// kit option - routed automatically, no `kit` nesting to think about:
	js.imports.addDefault(ast, { from: '@sveltejs/adapter-node', as: 'adapter' });
	override({
		adapter: js.functions.createCall({ name: 'adapter', args: [], useIdentifiers: true })
	});
});
```

- **`property(name, { fallback })`** - get-or-create an option's value to mutate in place (arrays, nested objects).
- **`override(props, { dropLeadingComments })`** - set/replace options; `dropLeadingComments` clears a now-stale leading comment (e.g. the adapter-auto note when switching adapters).
- **`config`** - the resolved raw config object for edits that need lower-level AST operations. In a Vite config this is the object passed to `sveltekit()`.

It writes through `sv.file`, so the edit is tracked like any other. If the project has neither config file, a `svelte.config.js` is created.

### `svelteConfig.find` / `svelteConfig.read`

Lower-level building blocks, both reading candidate files through an injected `read(path)` (returns the file contents or `null`) so detection stays static - the config is never executed:

- **`svelteConfig.find(read)`** - returns `{ path, kind }` or `null` (`kind` is `'vite'` or `'svelte'`; `svelte.config` wins when both are present).
- **`svelteConfig.read(read)`** - locates and parses in one pass, returning `{ location, config, kit }` (the object expressions) or `null`.

## Package manager helpers

### `pnpm.allowBuilds`

Returns a transform for `pnpm-workspace.yaml` that adds packages to the pnpm "allow builds" config. Use with `sv.file` when the project uses pnpm.

`cwd` is the target project: the pnpm version that would run there (via `pnpm.detectPnpmVersion`) decides the shape, so the invoker's `packageManager` pin is not used.

- pnpm `< 10.5`: no-op.
- pnpm `10.5` to `10.25`: writes `onlyBuiltDependencies`.
- pnpm `>= 10.26`: writes `allowBuilds` map (`{ pkg: true }`), migrating any legacy `onlyBuiltDependencies`.

```js
// @noErrors
import { pnpm } from '@sveltejs/sv-utils';

if (packageManager === 'pnpm') {
	sv.file(
		file.findUp('pnpm-workspace.yaml'),
		pnpm.allowBuilds({ cwd, packages: ['my-native-dep'] })
	);
}
```

### `pnpm.detectPnpmVersion`

Detects the version of pnpm that would run in `cwd`: Uses `pnpm --version` internally. Results are memoised per directory. Use it to branch on the target project's pnpm version, the same way `pnpm.allowBuilds` does internally.

```js
// @noErrors
import { pnpm } from '@sveltejs/sv-utils';

// inside an add-on's `run({ sv, cwd })`:
const version = pnpm.detectPnpmVersion(cwd);
```

> [!NOTE]
> `pnpm.supportsWorkspaceSettings` is deprecated. Use `pnpm.detectPnpmVersion` instead, and branch on the version yourself.

### Detecting the package manager

sv-utils re-exports a thin slice of [`package-manager-detector`](https://github.com/antfu/package-manager-detector):

- **`detect({ cwd })`** - resolves the package manager that would run in `cwd` (the `packageManager` pin and lockfiles), returning `{ name, agent, version }` or `null` when not found.
- **`resolveCommand(agent, command, args)`** - real command for an agent, e.g. `resolveCommand('pnpm', 'execute-local', ['vite', 'build'])` returns `{ command: 'pnpm', args: ['exec', 'vite', 'build'] }`, while npm returns `{ command: 'npx', args: ['vite', 'build'] }`. Returns `null` when the combination doesn't exist.
- **`resolveCommandArray(agent, command, args)`** - the same, flattened into one array for `spawn`-style APIs.
- **`constructCommand(value, args)`** - lower-level: merges arguments into a single agent command from `COMMANDS`.

The full registry is exported too: `AGENTS` (every supported agent's behaviors) and `COMMANDS` (every agent's command syntax), plus the `AgentName` type.

```js
// @noErrors
import { detect, resolveCommandArray } from '@sveltejs/sv-utils';

const pm = await detect({ cwd });
if (pm?.name === 'pnpm') {
	// ['pnpm', 'add', '-D', 'sharp']
	const cmd = resolveCommandArray(pm.agent, 'add', ['-D', 'sharp']);
}
```

## Env access

`defineEnv` abstracts over the two env modes a project can use: kit 2 without `experimental.explicitEnvironmentVariables` reads `$env/dynamic/*` / `$env/static/*`, while kit 3 (and kit 2 with that flag enabled) declares env vars with `defineEnvVars` in `src/env.ts` and reads them from `$app/env/*`. Declare once, reference anywhere - the right imports are added for you.

```js
// @noErrors
import { defineEnv } from '@sveltejs/sv-utils';

// inside an add-on's `run({ sv, cwd })`:
const env = defineEnv({ sv, cwd, dependencyVersion });

// declares the var (writes `src/env.ts` in declared mode, nothing in legacy mode)
env.define({ name: 'DATABASE_URL', description: 'The database connection string.' });

// inside a `transforms.script` callback: adds the env import matching the mode
const dbUrl = env.reference(ast, js, { name: 'DATABASE_URL' });
```

- **`env.define(spec)`** - declares an env var. In declared mode this maintains `export const variables = defineEnvVars({ ... })` in `src/env.{js,ts}`; in legacy mode it's a no-op (var files like `.env` are your concern).
- **`env.reference(ast, js, { name, scope?, static? })`** - adds the matching named import into the program and returns the expression to interpolate: `$app/env/{private|public}` in declared mode, `$env/static/*` or `env` from `$env/dynamic/*` (in which case the returned expression is `env.NAME`) in legacy mode.
- **`env.importEnv(ast, js, imports)`** - adds a named import from the env module (`building`, `dev`, `browser`, ...) resolved across modes (`$app/env` declared, `$app/environment` legacy).
- **`env.mode`** - the resolved `'legacy' | 'declared'` mode, if you must branch yourself.

## Kit version helpers

Helpers for add-ons that support kit 2 and 3:

- **`isKit3(kitRange)`** - whether a `@sveltejs/kit` range resolves to v3+, including the `next` dist-tag.
- **`resolveLibPrefix(kitRange)`** - the prefix for `src/lib` imports: `#lib` in kit 3 (which dropped the built-in `$lib` alias in favor of subpath imports), `$lib` otherwise.
- **`libSubpathImports(libDir)`** - the `package.json#imports` entries backing `#lib`, e.g. `{ '#lib': './src/lib/index.js', '#lib/*': './src/lib/*' }`.
- **`KIT3_TSCONFIG`** - `$app/tsconfig`, the config kit 3 generates into `node_modules`, replacing `.svelte-kit/tsconfig.json`.
- **`KIT3_TSCONFIG_DEFAULT`** - the options `$app/tsconfig` already sets. A local copy of the same value is noise, but a different value is a deliberate override and must stay.

```js
// @noErrors
import { isKit3, resolveLibPrefix, libSubpathImports } from '@sveltejs/sv-utils';

const prefix = resolveLibPrefix(dependencyVersion('@sveltejs/kit')); // e.g. '#lib'
if (prefix === '#lib') {
	sv.file('package.json', (content) => {
		// merge `libSubpathImports('src/lib')` into `package.json#imports`
	});
}
```

## Demo pages

### `defineDemoPage`

Wires an add-on demo into a SvelteKit project. Every demo is listed in a floating `DemoLinks` post-it rendered from the root layout, whatever the template. It returns the pieces you spread into `sv.file()`:

```js
// @noErrors
import { defineDemoPage } from '@sveltejs/sv-utils';

const demo = defineDemoPage('my-addon', language, directory.kitRoutes);

sv.file(...demo.links); // adds `/demo/my-addon` to `<routes>/demo/DemoLinks.svelte`
sv.file(...demo.layout); // renders `<DemoLinks />` in `<routes>/+layout.svelte`
sv.file(`${demo.addonPath}/+page.svelte` /* your demo route */);
```

- **`addonPath`** - `<routes>/demo/<name>`, where your own demo route belongs.
- **`links`** - a `[path, transform]` pair for `<routes>/demo/DemoLinks.svelte` (created if missing).
- **`layout`** - a `[path, transform]` pair for `<routes>/+layout.svelte` (created if missing).

Both transforms are idempotent, so re-running an add-on won't duplicate entries. Only call them when the user asked for a demo (e.g. a `demo` option), so projects without demos don't get the post-it. To opt out, delete `DemoLinks.svelte` and its usage in the layout.

## Browser usage

The package root pulls in Node-only APIs (file system, package manager detection, shell lookups, terminal colors). For browser bundles - in-browser playgrounds, sandboxes, ... - import `@sveltejs/sv-utils/browser` instead, which exposes the environment-agnostic subset: `parse`, `transforms`, the language namespaces (`js`, `svelte`, `css`, `html`, `json`, `text`), `Walker`, `dedent`, the version helpers, `sanitizeName`, `minimizeDiff`, `createPrinter` and `downloadJson`.

```js
// @noErrors
import { parse, transforms } from '@sveltejs/sv-utils/browser';
```
