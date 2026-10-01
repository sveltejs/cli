---
title: sv migrate
---

`sv migrate` migrates Svelte and SvelteKit codebases. Newer migrations use the task-based migration system in `sv`. Legacy migrations are delegated to [`svelte-migrate@1`](https://www.npmjs.com/package/svelte-migrate) and are kept available for older projects, but no longer receive updates.

Before migrating, make sure the project is committed and read the migration's linked changelog or migration guide. Migration code cannot account for every application, so review the resulting diff and run your project's checks after every step.

## Usage

```sh
npx sv migrate
```

When no migration is specified, `sv migrate` prompts you to pick one.

You can also specify a migration directly via the CLI:

```sh
npx sv migrate [migration]
```

For task-based migrations, `sv migrate` shows the migration tasks before applying them. Prerequisite tasks always run, and the remaining tasks can be selected interactively or with `--tasks`.

To make migration changes easier to review, run one selectable task at a time and commit the result before starting the next one. The task system is intended to create focused commits, not independent migration paths. Do not expect a project to work after running only a few tasks. Most projects need all applicable tasks before the migration is complete.

After a successful task-based migration, `sv` formats the changes using the project's `format` or `fmt` script when one exists, otherwise it formats changed files with Prettier when available. It then prompts to install updated dependencies. Some transformations leave `@migration-task` comments where manual work is required; search the project for that exact marker before considering the migration complete.

## Task-based migrations

### `sveltekit-3`

Upgrades a SvelteKit 2 app to SvelteKit 3. Read the [SvelteKit 3 changelog](https://github.com/sveltejs/kit/blob/version-3/packages/kit/CHANGELOG.md) before running it.

The migration is divided into these tasks:

- `package-json` (prerequisite) updates package versions for SvelteKit 3.
- `tsconfig` (prerequisite) extends the generated `$app/tsconfig` instead of `.svelte-kit/tsconfig.json`.
- `svelte-config` moves supported configuration from `svelte.config.*` into `vite.config.*` and updates imports of the old config where possible.
- `environment` replaces legacy environment modules with `$app/env` and creates `src/env.js` or `src/env.ts` declarations when needed.
- `paths` migrates deprecated `$app/paths` APIs and path types.
- `external-redirects` opts external redirects into the new redirect behavior.
- `shallow-routing` replaces shallow-routing APIs with `goto` calls.
- `params` consolidates route parameter matchers into `src/params.js` or `src/params.ts`.
- `app-state` migrates `$app/stores` usage to `$app/state`.

The migration only changes patterns it can identify safely. Review `@migration-task` comments and the SvelteKit 3 changelog for changes that require manual work.

### `app-state`

Migrates `$app/stores` usage to `$app/state` in `.svelte` files. See the [migration guide](/docs/kit/migrating-to-sveltekit-2#SvelteKit-2.12:-$app-stores-deprecated) for more details.

## Legacy migrations

The migrations below run through `svelte-migrate@1`. They remain available so older projects can move forward, but they no longer receive fixes or support for newly discovered code patterns. Commit your project first and carefully review their output.

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

These options apply to both task-based and legacy migrations.

### `--cwd <path>`

Run the migration in a different working directory. The path defaults to the current directory and must contain a `package.json`.

### `--no-git-check`

By default, `sv migrate` prompts before making changes when the git working tree is dirty. Use `--no-git-check` to skip this check.

### `--confirm`

Skip the final confirmation prompt before applying the migration. This does not skip migration selection or the dirty-working-tree check; provide the migration name and corresponding options for non-interactive use.

## Task-based migration options

These options do not apply to legacy migrations. Legacy migrations do not support task or file selection, and manage their own dependency installation behavior.

### `--files <glob>`

Limit the files saved by the migration to those matching a glob. This is an advanced escape hatch, not a way to run a complete migration on part of a project. Tasks often make related changes across configuration, source, and generated files; excluding any of them can leave imports, configuration, or types inconsistent and the project temporarily broken.

A task may still attempt to edit or create a file outside the glob. `sv migrate` does not save that file and reports it under **Unmodified files**. Review that list and rerun the relevant task without the filter, with a broader filter, or make the omitted changes manually.

When used with `--cwd`, the glob is relative to the working directory.

### `--tasks [task...]`

Select migration tasks without the interactive task prompt. Prerequisite tasks always run because they lay the foundation for the remaining tasks.

Use `--tasks` without any task IDs to print all available tasks for the migration without running them.

Use `--tasks all` to run every task, or `--tasks prerequisite` to run only the prerequisite tasks.

To keep changes reviewable, pass one task ID at a time, review and commit the result, then run the next task. Use `--tasks all` primarily for automation or when a single combined diff is intentional.

### `--install <package-manager>`

Install dependencies with a specified package manager:

- `npm`
- `pnpm`
- `yarn`
- `bun`
- `deno`

### `--no-install`

Skip installing dependencies after the migration.
