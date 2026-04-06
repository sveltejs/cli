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
- [`ai-tools`](ai-tools)
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

Community add-ons are npm packages published by the community. Look out for add-ons from your favourite libraries and tools. _(soon)_ Many developers are building `sv` add-ons to make their integrations a one-liner. You can find them on [npmx](https://www.npmx.dev/search?q=keyword:sv-add) by searching for the keyword: `sv-add`.

```sh
# Install a community add-on by org name (it will look at @org/sv)
npx sv add @supacool

# Use a local add-on (for development or internal use)
npx sv add file:../path/to/my-addon

# Mix and match official and community add-ons
npx sv add eslint @supacool

# Also works when creating a new project directly
npx sv create --add eslint @supacool
```

> [!NOTE]
> On Windows PowerShell, `@` is a special character that should be escaped with single quotes. For example: `npx sv add '@supacool'`.

Want to create your own? Check the [Add-on Docs](community).
