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

You can find community add-ons on npm by searching for `keywords:sv-add` on [npm](https://www.npmjs.com/search?q=keywords%3Asv-add).

### Protocols

We support two protocols for community add-ons:

- `file:[PATH_TO_ADDON]` - for local add-ons
- `@[ORG]` - for add-ons published under an npm organization. _Technically, it will look for `@[ORG]/sv`_

### How to create a community add-on

To start on a good track, create your add-on with the `addon` template.

```sh
npx sv create --template addon [path]
```

In your new add-on directory, check out the `README.md` and `CONTRIBUTING.md` files for more information.

### How to publish a community add-on

To publish your add-on to npm, run:

```sh
npm publish
```
