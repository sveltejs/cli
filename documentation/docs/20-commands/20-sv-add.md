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

- [`better-auth`](better-auth)
- [`devtools-json`](devtools-json)
- [`drizzle`](drizzle)
- [`eslint`](eslint)
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
> Community add-ons are currently **experimental**. The API may change. Don't use them in production yet!

> [!NOTE]
> Svelte maintainers have not reviewed community add-ons for malicious code!

You can find [community add-ons on npm](https://www.npmx.dev/search?q=keyword:sv-add) by searching for keyword: `sv-add`.

### How to install a community add-on

```sh
npx sv add @scope
npx sv add file:../path/to/my-addon
```

You can mix and match official and community add-ons, use the interactive prompt or pass args directly:

```sh
# In an existing project
npx sv add eslint @supacool

# Or when creating a new project
npx sv create --add eslint @supacool
```

### Package protocols

For **scoped packages**, the npm package name should be `@org/sv`. Users only need to type the scope:

```sh
# Installs the npm package `@supacool/sv`
npx sv add @supacool
```

For **local add-ons**, use the `file:` protocol. This is useful during development, but also for running custom add-ons that don't need to be published:

```sh
npx sv add file:../path/to/my-addon
```

> [!NOTE]
> Unscoped packages are not supported yet

### How to create a community add-on

Please checkout the [Add-on Docs](community) for more details.
