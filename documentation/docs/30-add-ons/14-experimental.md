---
title: experimental
---

Enables [Svelte](https://svelte.dev/docs/svelte/compiler-options) and [SvelteKit](https://svelte.dev/docs/kit/configuration#experimental) experimental features, and can opt your project into their `next` pre-release versions.

## Usage

```sh
npx sv add experimental
```

## What you get

- the selected experimental flags set in your config
- optionally `@sveltejs/kit` (and your adapter) moved to their `next` line

## Options

### versions

Which packages to move to their `next` pre-release version:

- `kit` — `@sveltejs/kit@next` (also bumps your adapter and required peers)

```sh
npx sv add experimental="versions:kit"
```

### features

Which experimental flags to enable:

- `async` — `await` in components
- `remoteFunctions` — remote functions
- `explicitEnvironmentVariables` — explicit environment variables (SvelteKit `^2` only)
- `handleRenderingErrors` — rendering error boundaries
- `forkPreloads` — forked preloading

```sh
npx sv add experimental="features:async,remoteFunctions"
```
