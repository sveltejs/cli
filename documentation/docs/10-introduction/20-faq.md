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

## Should my add-on bundle `@sveltejs/sv-utils`?

Most breaking changes land in `@sveltejs/sv-utils`, not `sv`. Each `sv` release ships one exact `@sveltejs/sv-utils` version, so you have two options:

- **Bundled** (template default): pins the version you tested against. Safest, costs ~1 MB.
- **Unbundled**: declare it in `peerDependencies`. Your add-on stays tiny and runs against the copy `sv` ships. When majors differ, `sv` warns and prints the command to rerun with the `sv` you built for: `npx sv@<peerDependencies.sv> add <your-addon>`.

If an unbundled add-on breaks for your users, they can run that command, and you can publish a fix for the latest `sv`. See [bundling](community#Publishing-Bundling).
