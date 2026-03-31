---
title: add-on
---

> [!NOTE]
> Community add-ons are currently **experimental**. The API may change. Don't use them in production yet!

This guide covers how to create, test, and publish community add-ons for `sv`.

## Quick start

The easiest way to create an add-on is using the `addon` template:

```sh
npx sv create --template addon [path]
```

The project has a `README.md` and `CONTRIBUTING.md` to guide you along.

## Project structure

Typically, an add-on looks like this:

```js
// @noErrors
import { transforms } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from 'sv';

// your add-on definition, the entry point
export default defineAddon({
	id: 'your-addon-name',

	// optional: one-liner shown in prompts
	shortDescription: 'does X',

	// optional: link to docs/repo
	homepage: 'https://...',

	// Define options for user prompts (or passed as arguments)
	options: defineAddonOptions()
		.add('who', {
			question: 'To whom should the addon say hello?',
			type: 'string' // boolean | number | select | multiselect
		})
		.build(),

	// preparing step, check requirements and dependencies
	setup: ({ dependsOn }) => {
		dependsOn('tailwindcss');
	},

	// actual execution of the addon
	run: ({ isKit, cancel, sv, options, directory }) => {
		if (!isKit) return cancel('SvelteKit is required');

		// Add "Hello [who]!" to the root page
		sv.file(
			directory.routes + '/+page.svelte',
			transforms.svelte(({ ast, svelte }) => {
				svelte.addFragment(ast, `<p>Hello ${options.who}!</p>`);
			})
		);
	}
});
```

> `sv` is responsible for the file system - `sv.file()` accepts a `path` to the file and a callback function to modify it.
> `@sveltejs/sv-utils` is responsible for the content - `transforms.svelte()` provides you with the proper AST and utils to modify the file. See [sv-utils](/docs/cli/sv-utils) for the full API.

## Development

While developing your add-on, you can test it locally using the `file:` protocol:

```sh
cd /path/to/test-project
npx sv add file:../path/to/my-addon
```

This allows you to iterate quickly without publishing to npm.

> [!NOTE]
> It is not necessary to build your add-on during development.

## Testing

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

> [!NOTE]
> It is not necessary to build your add-on during development.

## Publishing

### Bundling

Community add-ons are bundled with [tsdown](https://tsdown.dev/) into a single file. Everything is bundled except `sv`. (It is a peer dependency provided at runtime.)

### `package.json`

Your add-on must have `sv` as a peer dependency and **no** `dependencies` in `package.json`:

```json
{
	// must be scoped to `/sv`
	"name": "@your-org/sv",
	"version": "1.0.0",
	"type": "module",
	// entrypoint during developemnt
	"exports": {
		".": "./src/index.js"
	},
	"publishConfig": {
		"access": "public",
		// entrypoint on build
		"exports": {
			".": { "default": "./dist/index.js" }
		}
	},
	// cannot have dependencies
	"dependencies": {},
	"peerDependencies": {
		// minimum version required to run by this addon
		"sv": "^0.13.0"
	},
	// Add this keyword so users can discover your add-on
	"keywords": ["sv-add"]
}
```

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

### Publish to npm

Community add-ons must be scoped packages (e.g. `@your-org/sv`). Users install with `npx sv add @your-org`.

```sh
npm login
npm publish
```

> `prepublishOnly` automatically runs the build before publishing.

## Next steps

You can optionally display guidance in the console after your add-on runs:

```js
// @noErrors
import { color } from '@sveltejs/sv-utils';

export default defineAddon({
	// ...
	nextSteps: ({ options }) => [
		`Run ${color.command('npm run dev')} to start developing`,
		`Check out the docs at https://...`
	]
});
```

## Version compatibility

Your add-on should specify a minimum `sv` version in `peerDependencies`. Your user will get a compatibility warning if their `sv` version has a different major version than what was specified.

## Examples

See the [official add-on source code](https://github.com/sveltejs/cli/tree/main/packages/sv/src/addons) for some real world examples.
