---
title: sv migrate
---

`sv migrate` migrates Svelte(Kit) codebases. It delegates to the [`svelte-migrate`](https://www.npmjs.com/package/svelte-migrate) package.

Some migrations may annotate your codebase with tasks for completion that you can find by searching for `@migration`.

## Usage

```bash
npx sv migrate [migration]
```

## Migrations

### `svelte-5`

Upgrades a Svelte 4 app to use Svelte 5, and updates individual components to use [runes](../svelte/what-are-runes) and other Svelte 5 syntax ([see migration guide](../svelte/v5-migration-guide)).

### `self-closing-tags`

Replaces all the self-closing non-void elements in your `.svelte` files. See the [pull request](https://github.com/sveltejs/kit/pull/12128) for more details.

### `svelte-4`

Upgrades a Svelte 3 app to use Svelte 4 ([see migration guide](../svelte/v4-migration-guide)).

### `sveltekit-2`

Upgrades a SvelteKit 1 app to SvelteKit 2 ([see migration guide](../kit/migrating-to-sveltekit-2)).

### `package`

Upgrades a library using `@sveltejs/package` version 1 to version 2. See the [pull request](https://github.com/sveltejs/kit/pull/8922) for more details.

### `routes`

Upgrades a pre-release SvelteKit app to use the filesystem routing conventions in SvelteKit 1. See the [pull request](https://github.com/sveltejs/kit/discussions/5774) for more details.
