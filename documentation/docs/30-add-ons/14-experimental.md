---
title: experimental
---

Enables experimental Svelte and [SvelteKit](https://svelte.dev/docs/kit/configuration#experimental) features.

## Usage

```sh
npx sv add experimental
```

## What you get

- the selected experimental flags set in your config

## Options

### features

Which experimental flags to enable:

- `async` — `await` in components
- `remoteFunctions` — remote functions
- `forkPreloads` — forked preloading

```sh
npx sv add experimental="features:async,remoteFunctions"
```
