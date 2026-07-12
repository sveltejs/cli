---
title: sv migrate
---

`sv migrate` migrates Svelte(Kit) codebases. Some migrations are built into `sv`; older migrations are run through [`svelte-migrate@1`](https://www.npmjs.com/package/svelte-migrate).

Some migrations may annotate your codebase with tasks for completion that you can find by searching for `@migration`.

## Usage

```sh
npx sv migrate
```

When no migration is specified, `sv migrate` prompts you to pick one.

You can also specify a migration directly via the CLI:

```sh
npx sv migrate [migration]
```

For built-in migrations, `sv migrate` shows the migration steps before applying them. Required steps always run, and additional steps can be selected interactively or with `--tasks`. After a successful built-in migration, `sv` formats changed files when Prettier is installed and prompts to install any updated dependencies.

## Migrations

### `sveltekit-3`

Upgrades a SvelteKit 2 app to SvelteKit 3.

### `app-state`

Migrates `$app/stores` usage to `$app/state` in `.svelte` files. See the [migration guide](/docs/kit/migrating-to-sveltekit-2#SvelteKit-2.12:-$app-stores-deprecated) for more details.

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

## Options

### `--cwd <path>`

Run the migration in a different working directory.

### `--no-git-check`

By default, `sv migrate` prompts before making changes when the git working tree is dirty. Use `--no-git-check` to skip this check.

### `--files <glob>`

Limit the files considered for migration to those matching a glob. A migration may still try to edit or create files outside the glob, in which case `sv migrate` will show a warning.

When used with `--cwd`, the glob is relative to the working directory.

### `--tasks <task...>`

Select migration tasks without the interactive prompt. Prerequisite tasks always run because they lay the foundation for the remaining migration tasks.

Use `--tasks all` to run every task, or `--tasks prerequisite` to run only the prerequisite tasks.

### `--confirm`

Skip the final confirmation prompt before applying the migration.

### `--install <package-manager>`

Install dependencies with a specified package manager:

- `npm`
- `pnpm`
- `yarn`
- `bun`
- `deno`

### `--no-install`

Skip installing dependencies.
