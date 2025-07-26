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

- `-C`, `--cwd` — path to the root of your Svelte(Kit) project
- `--no-git-check` — even if some files are dirty, no prompt will be shown.
- `--install` — installs dependencies with a specified package manager
- `--no-install` — prevents installing dependencies

## Official add-ons

<!-- TODO: it'd be nice for this to live on the "add-ons" page, but we first need svelte.dev to support making pages from headings -->

- [`drizzle`](drizzle)
- [`eslint`](eslint)
- [`lucia`](lucia)
- [`mdsvex`](mdsvex)
- [`paraglide`](paraglide)
- [`playwright`](playwright)
- [`prettier`](prettier)
- [`storybook`](storybook)
- [`sveltekit-adapter`](sveltekit-adapter)
- [`tailwindcss`](tailwind)
- [`vitest`](vitest)
- [`devtools-json`](devtools-json)
