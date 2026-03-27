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
- **`@sveltejs/sv-utils`** = **what** to do to content. It provides parsers, language tooling, and typed transforms. Everything here is pure — no file system, no workspace awareness.

This separation means transforms are testable without a workspace and composable across add-ons.

## Transforms

Transforms are typed, parser-aware functions that turn `string -> string`. Each transform takes file content as its first argument, a callback to manipulate the parsed AST, and returns the updated content. The parser choice is baked into the transform type — you can't accidentally parse a vite config as Svelte because you never call a parser yourself.

```js
import { transforms, js, svelte, css, json } from '@sveltejs/sv-utils';
```

### `transforms.script`

Transform a JavaScript/TypeScript file. The callback receives the AST and comments.

```js
// @errors: 2304 7006
import { transforms, js } from '@sveltejs/sv-utils';

sv.file(files.viteConfig, (content) => {
	return transforms.script(content, (ast, comments) => {
		js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
		js.vite.addPlugin(ast, { code: 'foo()' });
	});
});
```

### `transforms.svelte`

Transform a Svelte component.

```js
// @errors: 2304 7006
import { transforms, js, svelte } from '@sveltejs/sv-utils';

sv.file(layoutPath, (content) => {
	return transforms.svelte(content, (ast) => {
		svelte.ensureScript(ast, { language });
		js.imports.addDefault(ast.instance.content, { as: 'Foo', from: './Foo.svelte' });
		svelte.addFragment(ast, '<Foo />');
	});
});
```

### `transforms.css`

Transform a CSS file.

```js
// @errors: 2304 7006
import { transforms, css } from '@sveltejs/sv-utils';

sv.file(files.stylesheet, (content) => {
	return transforms.css(content, (ast) => {
		css.addAtRule(ast, { name: 'import', params: "'tailwindcss'" });
	});
});
```

### `transforms.json`

Transform a JSON file. Mutate the `data` object directly.

```js
// @errors: 2304 7006
import { transforms } from '@sveltejs/sv-utils';

sv.file(files.tsconfig, (content) => {
	return transforms.json(content, (data) => {
		data.compilerOptions ??= {};
		data.compilerOptions.strict = true;
	});
});
```

### `transforms.yaml` / `transforms.toml`

Same pattern as `transforms.json`, for YAML and TOML files respectively.

### `transforms.text`

Transform a plain text file (.env, .gitignore, etc.). No parser — string in, string out.

```js
// @errors: 2304 7006
import { transforms } from '@sveltejs/sv-utils';

sv.file('.env', (content) => {
	return transforms.text(content, (data) => {
		return data + '\nDATABASE_URL="file:local.db"';
	});
});
```

### Aborting a transform

Return `false` from any transform callback to abort — the original content is returned unchanged.

```js
// @errors: 2304 7006
import { transforms, js } from '@sveltejs/sv-utils';

sv.file(files.eslintConfig, (content) => {
	return transforms.script(content, (ast) => {
		const { value: existing } = js.exports.createDefault(ast, { fallback: myConfig });
		if (existing !== myConfig) {
			// config already exists, don't touch it
			return false;
		}
		// ... continue modifying ast
	});
});
```

### Standalone usage & testing

Transforms are just functions — they work without the `sv` engine. Pass content directly:

```js
import { transforms, js } from '@sveltejs/sv-utils';

const result = transforms.script('export default {}', (ast) => {
	js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
});
```

### Composability

Since content flows through explicitly, you can mix transforms and raw edits in a single `sv.file` callback:

```js
// @errors: 2304 2552 7006
sv.file(path, (content) => {
	content = transforms.script(content, (ast) => {
		js.imports.addDefault(ast, { as: 'foo', from: 'foo' });
	});
	content = content.replace('foo', 'bar');
	return content;
});
```

Add-ons can also export reusable transform functions:

```js
// @errors: 7006
import { transforms, js, svelte } from '@sveltejs/sv-utils';

// reusable — export from your package
export function addFooImport(content, language) {
	return transforms.svelte(content, (ast) => {
		svelte.ensureScript(ast, { language });
		js.imports.addDefault(ast.instance.content, { as: 'Foo', from: './Foo.svelte' });
	});
}
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

- **`js.*`** — imports, exports, objects, arrays, variables, functions, vite config helpers, SvelteKit helpers
- **`css.*`** — rules, declarations, at-rules, imports
- **`svelte.*`** — ensureScript, addSlot, addFragment
- **`json.*`** — arrayUpsert, packageScriptsUpsert
- **`html.*`** — attribute manipulation
- **`text.*`** — upsert lines in flat files (.env, .gitignore)
