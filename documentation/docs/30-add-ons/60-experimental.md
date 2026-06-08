---
title: experimental
---

Enables [Svelte](https://svelte.dev/docs/svelte/compiler-options) and [SvelteKit](https://svelte.dev/docs/kit/configuration#experimental) experimental features, and can opt your project into the `next` (pre-release) versions where those features live.

> Experimental features are not subject to semantic versioning - they can change or be removed in any release.

## Usage

```sh
npx sv add experimental
```

## What you get

You're asked two questions.

### Versions

Whether to move packages to their `next` pre-release line. Today this offers `@sveltejs/kit@next` (SvelteKit 3, selected by default). When chosen, the add-on also raises the related peer dependencies if your project is below SvelteKit 3's floors (`vite` `^8`, `@sveltejs/vite-plugin-svelte` `^7`, `svelte` `^5.48`, and `typescript` `^6` for TypeScript projects). Versions that already satisfy the floor are left untouched.

> `svelte@next` is intentionally not offered: its `next` tag currently points at an older pre-release than the latest stable release.

### Features

A multi-select of experimental flags, written to your config wherever it lives (`svelte.config.{js,ts}` or the `sveltekit()` call in `vite.config.{js,ts}`). All are enabled by default except forked preloading:

| Feature | Config option |
| --- | --- |
| `async` (await in components) | `compilerOptions.experimental.async` |
| remote functions | `kit.experimental.remoteFunctions` |
| explicit environment variables | `kit.experimental.explicitEnvironmentVariables` (SvelteKit `^2` only) |
| rendering error boundaries | `kit.experimental.handleRenderingErrors` |
| forked preloading | `kit.experimental.forkPreloads` |

`explicitEnvironmentVariables` no longer exists in SvelteKit 3, so it is skipped automatically when you also select `@sveltejs/kit@next`.
