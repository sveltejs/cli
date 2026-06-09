---
title: sv-utils
---

> [!NOTE]
> `@sveltejs/sv-utils` is currently **experimental**. The API may change.

`@sveltejs/sv-utils` is an add-on utility for parsing, transforming, and generating code..

```sh
npm install -D @sveltejs/sv-utils
```

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
- **`text.*`** - upsert lines in flat files (.env, .gitignore)

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

It writes through `sv.file`, so the edit is tracked like any other. If the project has neither config file, a `svelte.config.js` is created.

### `svelteConfig.find` / `svelteConfig.read`

Lower-level building blocks, both reading candidate files through an injected `read(path)` (returns the file contents or `null`) so detection stays static - the config is never executed:

- **`svelteConfig.find(read)`** - returns `{ path, kind }` or `null` (`kind` is `'vite'` or `'svelte'`; `svelte.config` wins when both are present).
- **`svelteConfig.read(read)`** - locates and parses in one pass, returning `{ location, config, kit }` (the object expressions) or `null`.

## Package manager helpers

### `pnpm.allowBuilds`

Returns a transform for `pnpm-workspace.yaml` that adds packages to the pnpm "allow builds" config. Use with `sv.file` when the project uses pnpm.

The helper detects the installed pnpm version via `pnpm --version`:

- pnpm `>= 11`: writes to the unified `allowBuilds` map (`{ pkg: true }`), migrating any legacy `onlyBuiltDependencies` list into the map.
- pnpm `< 11`: writes to the legacy `onlyBuiltDependencies` list.

```js
// @noErrors
import { pnpm } from '@sveltejs/sv-utils';

if (packageManager === 'pnpm') {
	sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds('my-native-dep'));
}
```
