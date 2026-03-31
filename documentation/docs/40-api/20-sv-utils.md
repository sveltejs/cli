---
title: sv-utils
---

> [!NOTE]
> `@sveltejs/sv-utils` is currently **experimental**. The API may change. Full documentation is not yet available.

`@sveltejs/sv-utils` provides utilities for parsing, transforming, and generating code in add-ons.

```sh
npm install -D @sveltejs/sv-utils
```

## Architecture

The Svelte CLI is split into two packages with a clear boundary:

- **`sv`** = **where and when** to do it. It owns paths, workspace detection, dependency tracking, and file I/O. The engine orchestrates add-on execution.
- **`@sveltejs/sv-utils`** = **what** to do to content. It provides parsers, language tooling, and typed transforms. Everything here is pure - no file system, no workspace awareness.

This separation means transforms are testable without a workspace and composable across add-ons.

## Transforms

Transforms are curried, parser-aware functions that turn `string -> string`. Call a transform with your callback to get a function that plugs directly into `sv.file()`. The parser choice is baked into the transform type - you can't accidentally parse a vite config as Svelte because you never call a parser yourself.

Each transform injects relevant utilities into the callback, so you only need one import:

```js
import { transforms } from '@sveltejs/sv-utils';
```

### `transforms.script`

Transform a JavaScript/TypeScript file. The callback receives `{ ast, comments, content, js }`.

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';

sv.file(
	files.viteConfig,
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
	transforms.svelteScript({ language }, ({ ast, svelte, js }) => {
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
	files.stylesheet,
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
	files.tsconfig,
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
	files.eslintConfig,
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

const result = transforms.script(({ ast, js }) => {
	js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
})('export default {}');
```

### Composability

For cases where you need to mix transforms and raw edits, use `sv.file` with a content callback and invoke the curried transform manually:

```js
// @noErrors
sv.file(path, (content) => {
	// curried
	content = transforms.script(({ ast, js }) => {
		js.imports.addDefault(ast, { as: 'foo', from: 'bar' });
	})(content);

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

## Parsers (low-level)

For cases where transforms don't fit (e.g., conditional parsing, error handling around the parser), the `parse` namespace is still available:

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
