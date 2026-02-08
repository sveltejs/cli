---
title: sv docs
---

`sv docs` fetches Svelte and SvelteKit documentation directly from the terminal. It delegates to the [`@sveltejs/mcp`](https://www.npmjs.com/package/@sveltejs/mcp) package.

It outputs clean Markdown to standard output, making it useful for humans browsing docs without leaving the terminal, but also for AI coding agents — since there are no HTML tags or web page noise, agents can read the output directly. You can reference `sv docs` commands in files like `CLAUDE.md` or similar agent instructions to give your AI assistant access to up-to-date Svelte documentation.

## Usage

List all available documentation sections:

```sh
npx sv docs --list
```

Fetch documentation for a specific section:

```sh
npx sv docs [section]
```

For example:

```sh
npx sv docs svelte/snippet
npx sv docs kit/routing
```

## Options

### `--list`

Lists all available documentation sections.

### `-C, --cwd`

Path to working directory.
