---
title: tailwindcss
---

[Tailwind CSS](https://tailwindcss.com/) allows you to rapidly build modern websites without ever leaving your HTML.

## Usage

```sh
npx sv add tailwindcss
```

## What you get

- Tailwind setup following the [Tailwind for SvelteKit guide](https://tailwindcss.com/docs/installation/framework-guides/sveltekit)
- Tailwind Vite plugin
- updated `app.css` and `+layout.svelte` (for SvelteKit) or `App.svelte` (for non-SvelteKit Vite apps)
- integration with `prettier` if using that package

## Options

### plugins

Which plugin to use:

- `typography` — [`@tailwindcss/typography`](https://github.com/tailwindlabs/tailwindcss-typography)
- `forms` — [`@tailwindcss/forms`](https://github.com/tailwindlabs/tailwindcss-forms)

```sh
npx sv add tailwindcss="plugins:typography"
```
