---
title: sv add
---

`sv add` updates an existing project with new functionality.

## Usage

```bash
npx sv add
```

```bash
npx sv add [add-ons]
```

You can select multiple space-separated add-ons from [the list below](#Official-add-ons), or you can use the interactive prompt.

## Options

- `-C`, `--cwd` — path to the root of your Svelte(Kit) project
- `--no-preconditions` — skip checking preconditions <!-- TODO what does this mean? -->
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
- [`chromium-devtools`](chromium-devtools)
