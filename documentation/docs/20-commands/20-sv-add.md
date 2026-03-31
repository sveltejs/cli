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

