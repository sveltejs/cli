---
title: add-on
---

> [!NOTE]
> Community add-ons are currently **experimental**. The API may change. Don't use them in production yet!

This guide covers how to create, test, and publish community add-ons for `sv`.

## Quick start

The easiest way to create an add-on is using the addon template:

```sh
npx sv create --template addon my-addon
```

## Add-on structure

Typically, an add-on looks like this:

_hover keywords in the code to have some more context_

```js
// @errors: 2304 7006 2552
import { transforms, svelte } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from 'sv';

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
	// shortDescription: 'does X',   // optional: one-liner shown in prompts
	// homepage: 'https://...',      // optional: link to docs/repo

	options,

	// preparing step, check requirements and dependencies
	setup: ({ dependsOn }) => {
		dependsOn('tailwindcss');
	},

	// actual execution of the addon
	run: ({ isKit, cancel, sv, options, directory }) => {
		if (!isKit) return cancel('SvelteKit is required');

		// Add "Hello [who]!" to the root page
		sv.file(directory.routes + '/+page.svelte', (content) => {
			return transforms.svelte(content, (ast) => {
				svelte.addFragment(ast, `<p>Hello ${options.who}!</p>`);
			});
		});
	}
});
```

> `sv` owns the file system — `sv.file()` resolves the path, reads the file, applies the edit function, and writes the result.
> `@sveltejs/sv-utils` owns the content — `transforms.svelte()` handles parsing, gives you the AST, and serializes back. See [sv-utils](/docs/cli/sv-utils) for the full API.

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
import { setupTest } from 'sv/testing';
import { test, expect } from 'vitest';
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

## Building and publishing

### Bundling

Community add-ons are bundled with [tsdown](https://tsdown.dev/) into a single file. Everything is bundled except `sv` (peer dependency, provided at runtime).

```sh
npm run build
```

### Package structure

Your add-on must have `sv` as a peer dependency and **no** `dependencies` in `package.json`:

```json
{
	"name": "@your-org/sv",
	"version": "1.0.0",
	"type": "module",
	"exports": {
		".": "./src/index.js"
	},
	"publishConfig": {
		"access": "public",
		"exports": {
			".": { "default": "./dist/index.js" }
		}
	},
	"peerDependencies": {
		"sv": "^0.13.0"
	},
	"keywords": ["sv-add"]
}
```

- `exports` points to `./src/index.js` for local development with the `file:` protocol.
- `publishConfig.exports` overrides exports when publishing, pointing to the bundled `./dist/index.js`.

> [!NOTE]
> Add the `sv-add` keyword so users can discover your add-on on npm.

### Export options

Your package can export the add-on in two ways:

1. **Default export** (recommended for dedicated add-on packages):

   ```json
   {
   	"exports": {
   		".": "./src/index.js"
   	}
   }
   ```

2. **`/sv` export** (for packages that have other functionality):
   ```json
   {
   	"exports": {
   		".": "./src/main.js",
   		"./sv": "./src/addon.js"
   	}
   }
   ```

### Publishing

Community add-ons must be scoped packages (e.g. `@your-org/sv`). Users install with `npx sv add @your-org`.

```sh
npm login
npm publish
```

> `prepublishOnly` automatically runs the build before publishing.

## Next steps

You can optionally display guidance after your add-on runs:

```js
// @errors: 2304 7031
export default defineAddon({
	// ...
	nextSteps: ({ options }) => [
		`Run ${color.command('npm run dev')} to start developing`,
		`Check out the docs at https://...`
	]
});
```

## Version compatibility

Your add-on should specify the minimum `sv` version it requires in `peerDependencies`. If a user's `sv` version has a different major version than what your add-on was built for, they will see a compatibility warning.
