---
title: sv add
---

`sv add` updates an existing project with new functionality.

## Usage

```sh
npx sv add
```

```sh
npx sv add [add-ons]
```

You can select multiple space-separated add-ons from [the list below](#Official-add-ons), or you can use the interactive prompt.

## Options

### `-C`, `--cwd`

Path to the root of your Svelte(Kit) project.

### `--no-git-check`

Even if some files are dirty, no prompt will be shown

### `--install <package-manager>`

Installs dependencies with a specified package manager:

- `npm`
- `pnpm`
- `yarn`
- `bun`
- `deno`

### `--no-install`

Prevents installing dependencies

## Official add-ons

- [`devtools-json`](devtools-json)
- [`drizzle`](drizzle)
- [`eslint`](eslint)
- [`lucia`](lucia)
- [`mcp`](mcp)
- [`mdsvex`](mdsvex)
- [`paraglide`](paraglide)
- [`playwright`](playwright)
- [`prettier`](prettier)
- [`storybook`](storybook)
- [`sveltekit-adapter`](sveltekit-adapter)
- [`tailwindcss`](tailwind)
- [`vitest`](vitest)

## Community add-ons

> [!NOTE]
> Svelte maintainers have not reviewed community add-ons for malicious code. Use at your discretion.

You can find [community add-ons on npm](https://www.npmjs.com/search?q=keywords%3Asv-add) by searching for `keywords:sv-add`.

### How to install a community add-on

To install a community add-on, run:

```sh
npx sv add [PROTOCOL][COMMUNITY_ADDON]
```

You can also use the `--add` option in the `create` command and mix and match official and community add-ons like:

```sh
npx sv create --add eslint @supacool
```

### Protocols

We support two protocols for community add-ons:

- `file:[PATH_TO_ADDON]` - for local add-ons

example:

```sh
npx sv add file:../path/to/my-addon
```

- `@[ORG]` - for `sv` add-ons published under an npm organization.
  - Giving only the organization name will look for `@[ORG]/sv` _(preferred)_
  - This `@[ORG]/my-super-cool-sv-addon` will also work, but less nice!

example:

```sh
npx sv add @supacool
```

### How to create a community add-on

To start on a good track, create your add-on with the `addon` template.

```sh
npx sv create --template addon [path]
```

In your new add-on directory, check out the `README.md` and `CONTRIBUTING.md` to get started.

To get some inspiration, of what can be done, check out [official addons source code](https://github.com/sveltejs/cli/tree/feat/community-add-on-draft-0/packages/sv/lib/addons).

### Overview of an add-on

Typically, add `add-on` looks like this:

```js
import { defineAddon, defineAddonOptions, js, parse, svelte } from 'sv/core';

// You can define options that will be prompted to the user if they are not provided when calling the cli.
const options = defineAddonOptions()
	.add('who', {
		question: 'To whom should the addon say hello?',
		type: 'string', // string, number, boolean, select, multiselect
		default: ''
	})
	.build();

export default defineAddon({
	id: 'your-addon-name',
	options,

	// This is called before the addon is run.
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},

	// This is the actual execution of the addon... Add files, edit files, etc.
	run: ({ kit, sv, options, typescript }) => {
		if (!kit) throw new Error('SvelteKit is required');

		// add/edit a file
		sv.file(kit.routesDirectory + '/+page.svelte', (content) => {
			const { ast, generateCode } = parse.svelte(content);

			ast.fragment.nodes.push(...svelte.toFragment('<p>Hello World</p>'));

			return generateCode();
		});
	}
});
```
