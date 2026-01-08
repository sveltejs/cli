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

### `--no-download-check`

Skip all download confirmation prompts

> [!IMPORTANT]
> Svelte maintainers have not reviewed community add-ons for malicious code. Use at your discretion

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
> Svelte maintainers have not reviewed community add-ons for malicious code!

You can find [community add-ons on npm](https://www.npmjs.com/search?q=keywords%3Asv-add) by searching for `keywords:sv-add`.

### How to install a community add-on

```sh
npx sv add [PROTOCOL][COMMUNITY_ADDON]
```

You can:

- mix and match official and community add-ons
- use the interactive prompt or give args to the cli
- use the `--add` option in the `create` command

```sh
npx sv add eslint @supacool
```

```sh
npx sv create --add eslint @supacool
```

### Protocols

We support two protocols for community add-ons:

- `@[ORG]` - for `sv` add-ons published under an npm organization.
  - Giving only the organization name will look for `@[ORG]/sv` _(preferred)_
  - This `@[ORG]/my-super-cool-sv-addon` will also work, _but is more wordy!_

```sh
npx sv add @supacool
```

- `file:[PATH_TO_ADDON]` - for local add-ons. It could be useful for scafolding related to a specific project for example.

```sh
npx sv add file:../path/to/my-addon
```

### How to create a community add-on

To start on a good track, create your add-on with the `addon` template.

```sh
npx sv create --template addon [path]
```

In your new add-on directory, check out the `README.md` and `CONTRIBUTING.md` to get started.

Then you can continue with the [API docs](/docs/cli/add-on) to start building your add-on. You can also have a look at the [official addons source code](https://github.com/sveltejs/cli/tree/feat/community-add-on-draft-0/packages/sv/lib/addons) to get some inspiration on what can be done.
