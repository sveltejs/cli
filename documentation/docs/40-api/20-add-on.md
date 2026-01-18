---
title: add-on
---

> [!WARNING]
> Community add-ons are currently **experimental**. The API may change. Don't use them in production yet!

This guide covers how to create, test, and publish community add-ons for `sv`.

## Quick start

The easiest way to create an add-on is using the addon template:

```sh
npx sv create --template addon my-addon
cd my-addon
```

## Add-on structure

Typically, an add-on looks like this:

_hover keywords in the code to have some more context_

```js
import { defineAddon, defineAddonOptions, parse, svelte } from 'sv/core';

// Define options that will be prompted to the user (or passed as arguments)
const options = defineAddonOptions()
	.add('who', {
		question: 'To whom should the addon say hello?',
		type: 'string' // boolean | number | select | multiselect
	})
	.build();

// your add-on definition, the entry point
export default defineAddon({
	id: 'your-addon-name',

	options,

	// preparing step, check requirements and dependencies
	setup: ({ dependsOn }) => {
		dependsOn('tailwindcss');
	},

	// actual execution of the addon
	run: ({ kit, cancel, sv, options }) => {
		if (!kit) return cancel('SvelteKit is required');

		// Add "Hello [who]!"" to the root page
		sv.file(kit.routesDirectory + '/+page.svelte', (content) => {
			const { ast, generateCode } = parse.svelte(content);

			svelte.addFragment(ast, `<p>Hello ${options.who}!</p>`);

			return generateCode();
		});
	}
});
```

## Development with `file:` protocol

While developing your add-on, you can test it locally using the `file:` protocol:

```sh
# In your test project
npx sv add file:../path/to/my-addon
```

This allows you to iterate quickly without publishing to npm.

## Testing with `sv/testing`

The `sv/testing` module provides utilities for testing your add-on:

```js
import { test, expect } from 'vitest';
import { setupTest } from 'sv/testing';
import addon from './index.js';

test('adds hello message', async () => {
	const { content } = await setupTest({
		addon,
		options: { who: 'World' },
		files: {
			'src/routes/+page.svelte': '<h1>Welcome</h1>'
		}
	});

	expect(content('src/routes/+page.svelte')).toContain('Hello World!');
});
```

## Publishing to npm

### Package structure

Your add-on must have `sv` as a dependency in `package.json`:

```json
{
	"name": "@your-org/sv",
	"version": "1.0.0",
	"type": "module",
	"exports": {
		".": "./dist/index.js"
	},
	"dependencies": {
		"sv": "^0.11.0"
	},
	"keywords": ["sv-add"]
}
```

> [!NOTE]
> Add the `sv-add` keyword so users can discover your add-on on npm.

### Export options

Your package can export the add-on in two ways:

1. **Default export** (recommended for dedicated add-on packages):
   ```json
   {
   	"exports": {
   		".": "./dist/index.js"
   	}
   }
   ```

2. **`/sv` export** (for packages that have other functionality):
   ```json
   {
   	"exports": {
   		".": "./dist/main.js",
   		"./sv": "./dist/addon.js"
   	}
   }
   ```

### Naming conventions

- **Scoped packages**: Use `@your-org/sv` as the package name. Users can then install with just `npx sv add @your-org`.
- **Regular packages**: Any name works. Users install with `npx sv add your-package-name`.

## Version compatibility

Your add-on should specify the minimum `sv` version it requires in `package.json`. If a user's `sv` version has a different major version than what your add-on was built for, they will see a compatibility warning.
