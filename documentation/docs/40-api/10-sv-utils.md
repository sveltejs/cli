---
title: sv-utils
---

`@sveltejs/sv-utils` provides utilities for parsing, transforming, and generating code in add-ons.

```sh
npm install @sveltejs/sv-utils
```

## `parse`

Parse source code into an AST, manipulate it, then call `generateCode()` to serialize it back.

```js
import { parse } from '@sveltejs/sv-utils';

const { ast, generateCode } = parse.script('const a = 1;');
const { ast, generateCode } = parse.svelte('<h1>Hello</h1>');
const { ast, generateCode } = parse.css('body { color: red; }');
const { ast, generateCode } = parse.html('<div>Hello</div>');
const { data, generateCode } = parse.json('{ "name": "John" }');
const { data, generateCode } = parse.yaml('name: John');
const { data, generateCode } = parse.toml('name = "John"');
```

## `js`

Manipulate JavaScript/TypeScript ASTs.

### `js.imports`

```js
import { js, parse } from '@sveltejs/sv-utils';

const { ast, generateCode } = parse.script('');

// Add a default import
js.imports.addDefault(ast, { as: 'Component', from: './Component.svelte' });

// Add named imports
js.imports.addNamed(ast, { names: ['onMount', 'tick'], from: 'svelte' });

// Remove an import
js.imports.removeImport(ast, 'svelte');
```

### `js.exports`

```js
// Add a named export
js.exports.addNamed(ast, { name: 'foo', value: 'bar' });

// Add a default export
js.exports.addDefault(ast, { value: 'app' });
```

### `js.variables`

```js
// Add a variable declaration
js.variables.addDeclaration(ast, { name: 'config', value: '{}' });
```

### `js.object`

```js
// Add a property to an object
js.object.addProperty(ast, { name: 'key', value: '"value"' });
```

### `js.functions`

```js
// Create a function call
js.functions.addFunctionCall(ast, { name: 'console.log', args: ['"hello"'] });
```

### `js.array`

```js
// Append to an array
js.array.push(ast, { value: '"new-item"' });
```

### `js.common`

```js
// Create an expression from a string
js.common.expressionFromString('process.env.NODE_ENV');

// Create a type property (for TypeScript interfaces)
js.common.createTypeProperty('env', 'Env');
```

### `js.kit`

SvelteKit-specific utilities.

```js
// Add or get a global App interface (e.g. App.Locals, App.Platform)
const platform = js.kit.addGlobalAppInterface(ast, { name: 'Platform' });
```

### `js.vite`

Vite config manipulation.

```js
// Add a Vite plugin
js.vite.addPlugin(ast, { name: 'myPlugin', import: './my-plugin' });
```

## `css`

Manipulate CSS ASTs.

```js
import { css, parse } from '@sveltejs/sv-utils';

const { ast, generateCode } = parse.css('');

// Add a CSS rule
const rule = css.addRule(ast, { selector: '.container' });

// Add a declaration to a rule
css.addDeclaration(rule, { property: 'display', value: 'flex' });

// Add @import rules
css.addImports(ast, { imports: ['tailwindcss'] });

// Add @-rules (keyframes, media queries, etc.)
css.addAtRule(ast, { name: 'keyframes', params: 'fade-in', append: true });
```

## `html`

Manipulate HTML ASTs.

```js
import { html, parse } from '@sveltejs/sv-utils';

const { ast, generateCode } = parse.html('');

// Create an element
const div = html.createElement('div', { class: 'container' });

// Add an attribute
html.addAttribute(div, 'id', 'app');

// Add raw HTML
html.addFromRawHtml(ast, '<link rel="stylesheet" href="style.css" />');
```

## `svelte`

Manipulate Svelte component ASTs.

```js
import { parse, svelte } from '@sveltejs/sv-utils';

const { ast, generateCode } = parse.svelte('<h1>Hello</h1>');

// Ensure a <script> block exists
svelte.ensureScript(ast, { language: 'ts' });

// Add content to the template
svelte.addFragment(ast, '<p>World</p>');
```

## `text`

Manipulate flat text files (`.env`, `.gitignore`, etc.).

```js
import { text } from '@sveltejs/sv-utils';

const updated = text.upsert(content, 'NODE_ENV', {
	value: 'development',
	comment: 'Environment variable'
});
```

## `json`

Manipulate parsed JSON data.

```js
import { json, parse } from '@sveltejs/sv-utils';

const { data, generateCode } = parse.json('{ "scripts": {} }');

// Add a package.json script
json.packageScriptsUpsert(data, 'test', 'vitest');

// Upsert into an array
json.arrayUpsert(data, 'keywords', 'svelte');
```

## Types

```ts
import type { AstTypes, SvelteAst, Comments } from '@sveltejs/sv-utils';
```

- `AstTypes` &mdash; TypeScript ESTree AST node types
- `SvelteAst` &mdash; Svelte compiler AST types
- `Comments` &mdash; Comment tracking for JS/TS code generation
