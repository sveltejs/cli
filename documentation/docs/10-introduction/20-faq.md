---
title: Frequently asked questions
---

## How do I run the `sv` CLI?

Running `sv` looks slightly different for each package manager. Here is a list of the most common commands:

- **npm** : `npx sv create`
- **pnpm** : `pnpm dlx sv create`
- **Bun** : `bunx sv create`
- **Deno** : `deno run npm:sv create`
- **Yarn** : `yarn dlx sv create`

## `npx sv` is not working

Some package managers prefer to run locally installed tools instead of downloading and executing packages from the registry. This issue mostly occurs with `npm` and `yarn`. This usually results in an error message or looks like the command you were trying to execute did not do anything.

Here is a list of issues with possible solutions that users have encountered in the past:

- [`npx sv` create does nothing](https://github.com/sveltejs/cli/issues/472)
- [`sv` command name collides with `runit`](https://github.com/sveltejs/cli/issues/259)
- [`sv` in windows powershell conflicts with `Set-Variable`](https://github.com/sveltejs/cli/issues/317)

## Why are there two packages, `sv` and `@sveltejs/sv-utils`?

They have a clear boundary:

- [`sv`](sv) decides **where and when**: paths, workspace detection, dependencies and file I/O.
- [`@sveltejs/sv-utils`](sv-utils) decides **what** to do to content: parsers and pure transforms, with no file system or workspace awareness.

This keeps transforms testable without a workspace and composable across add-ons.

## Why bundle `@sveltejs/sv-utils` in my add-on?

Most breaking changes land in `@sveltejs/sv-utils`, not `sv`. An add-on that leaves it unbundled still loads, but runs against whatever copy `sv` ships, so a future `sv` release can break it. Bundling pins the version you tested against, so users can trust your add-on keeps working.

The [add-on template](community#Quick-start) already bundles it: keep it that way. See [bundling](community#Publishing-Bundling).
