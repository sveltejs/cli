---
title: mdsvex
---

[mdsvex](https://next.mdsvex.pages.dev) turns markdown files into Svelte components - basically MDX for Svelte. It allows you to use Svelte components in your markdown, or markdown in your Svelte components.

## Usage

```sh
npx sv add mdsvex
```

You can optionally select from mdsvex's first-party plugins with a searchable prompt:

```sh
npx sv add 'mdsvex=plugins:callouts,toc'
```

The interactive prompt preselects page data, anchors, table of contents, figures, code blocks,
and external links.

## What you get

- mdsvex installed and configured as a Vite plugin
- `.svx` files enabled as Svelte components
- any selected [first-party plugins](https://next.mdsvex.pages.dev/docs/plugins) installed and enabled
