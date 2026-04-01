---
title: [create your own]
---

> [!NOTE]
> Community add-ons are currently **experimental**. The API may change. Don't use them in production yet!

This guide covers how to create, test, and publish community add-ons for `sv`.

## Quick start

The easiest way to create an add-on is by using the `addon` template:

```sh
npx sv create --template addon [path]
```

The newly created project will have a `README.md` and `CONTRIBUTING.md` to guide you along.

## Project structure

Typically, an add-on looks like this:

```js
import { transforms } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from 'sv';

export default defineAddon({
	id: 'your-addon-name',

	shortDescription: 'a better description of what your addon does ;)',

	options: defineAddonOptions()
		.add('who', {
			question: 'To whom should the addon say hello?',
			type: 'string' // boolean | number | select | multiselect
		})
		.build(),

	setup: ({ dependsOn }) => {
		dependsOn('vitest');
	},

	run: ({ isKit, cancel, sv, options, file, language, directory }) => {
		if (!isKit) return cancel('SvelteKit is required');

		// Add "Hello [who]!" to the root page
		sv.file(
			directory.kitRoutes + '/+page.svelte',
			transforms.svelte(({ ast, svelte }) => {
				svelte.addFragment(ast, `<p>Hello ${options.who}!</p>`);
			})
		);
	}
});
```

The Svelte CLI is split into two packages with a clear boundary:

- [**`sv`**](sv) = **where and when** to do it. It owns paths, workspace detection, dependency tracking, and file I/O. The engine orchestrates add-on execution.
- [**`@sveltejs/sv-utils`**](sv-utils) = **what** to do to content. It provides parsers, language tooling, and typed transforms. Everything here is pure - no file system, no workspace awareness.

This separation means transforms are testable without a workspace and composable across add-ons.

## Development

You can run your add-on locally using the `file:` protocol:

```sh
cd /path/to/test-project
npx sv add file:../path/to/my-addon
```

This allows you to iterate quickly without publishing to npm.

The `file:` protocol also works for custom or private add-ons that you don't intend to publish - for example, to standardize project setup across your team or organization.

> [!NOTE]
> The `demo-add` script automatically builds your add-on before running it.

## Testing

The `sv/testing` module provides utilities for testing your add-on. `createSetupTest` is a factory that takes your vitest imports and returns a `setupTest` function. It creates real SvelteKit projects from templates, runs your add-on, and gives you access to the resulting files.

```js
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createSetupTest } from 'sv/testing';
import * as vitest from 'vitest';
import addon from './index.js';

const { test, testCases } = createSetupTest(vitest)(
	{ addon },
	{
		kinds: [
			{
				type: 'default',
				options: {
					'your-addon-name': { who: 'World' }
				}
			}
		],
		filter: (testCase) => testCase.variant.includes('kit'),
		browser: false
	}
);

test.concurrent.for(testCases)('my-addon $kind.type $variant', async (testCase, ctx) => {
	const cwd = ctx.cwd(testCase);

	const page = fs.readFileSync(path.resolve(cwd, 'src/routes/+page.svelte'), 'utf8');
	expect(page).toContain('Hello World!');
});
```

Your `vitest.config.js` must include the global setup from `sv/testing`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.{js,ts}'],
		globalSetup: ['tests/setup/global.js']
	}
});
```

And the global test setup script `tests/setup/global.js`:

```js
import { fileURLToPath } from 'node:url';
import { setupGlobal } from 'sv/testing';

const TEST_DIR = fileURLToPath(new URL('../../.test-output/', import.meta.url));

export default setupGlobal({ TEST_DIR });
```

## Publishing

### Bundling

Community add-ons are bundled with [tsdown](https://tsdown.dev/) into a single file. Everything is bundled except `sv`. (It is a peer dependency provided at runtime.)

### `package.json`

Your add-on must have `sv` as a peer dependency and **no** `dependencies` in `package.json`:

```jsonc
{
	"name": "@my-org/sv",
	"version": "1.0.0",
	"type": "module",
	// bundled entrypoint (tsdown outputs .mjs for ESM)
	"exports": {
		".": { "default": "./dist/index.mjs" }
	},
	"publishConfig": {
		"access": "public"
	},
	// cannot have dependencies
	"dependencies": {},
	"peerDependencies": {
		// minimum version required to run by this add-on
		"sv": "^0.13.0"
	},
	// Add the "sv-add" keyword so users can discover your add-on
	"keywords": ["sv-add", "svelte", "sveltekit"]
}
```

### Naming convention

#### packages names

If you name your package `@my-org/sv`, users can install it by typing just the org handle:

```sh
npx sv add @my-org
```

It's also possible to publish like `@my-org/core`, just users will need to type the full package name.

```sh
npx sv add @my-org/core
```

> [!NOTE]
> Unscoped packages are not supported yet

#### export options

`sv` first tries to import `your-package/sv`, then falls back to the default export. This means you have two options:

1. **Default export** (for dedicated add-on packages):

   ```json
   {
   	"exports": {
   		".": "./src/index.js"
   	}
   }
   ```

2. **`./sv` export** (for packages that also export other functionality):
   ```json
   {
   	"exports": {
   		".": "./src/main.js",
   		"./sv": "./src/addon.js"
   	}
   }
   ```

### Publish to npm

```sh
npm login
npm publish
```

> `prepublishOnly` automatically runs the build before publishing.

## Next steps

You can optionally display guidance in the console after your add-on runs:

```js
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

Your add-on should specify a minimum `sv` version in `peerDependencies`. Your users will get a compatibility warning if their `sv` version has a different major version than what was specified.

## Examples

See the [official add-on source code](https://github.com/sveltejs/cli/tree/main/packages/sv/src/addons) for some real world examples.
