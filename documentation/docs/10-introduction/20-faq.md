---
title: Frequently asked questions
---

## How do i run the the `sv` cli?

Running the `sv` cli differs for each package manager. Here is a list of the most common commands:

- **NPM** : `npx sv create`
- **PNPM** : `pnpm dlx sv create`
- **Yarn** : `yarn dlx sv create`
- **Bun** : `bunx sv create`
- **Deno** : `deno run npm:sv create`

## `npx sv` is not working

Some package mangers prefer to run locally installed tools instead of downloading and executing packages from the registry. This issue mostly occurs with `npm` and `yarn`. This usually results in an error message or looks like the command you were trying to execute did not do anything.

Here is a list of issues with possible solution, users have encountered in the past

- [`npx sv` create does nothing](https://github.com/sveltejs/cli/issues/472)
- [Document `sv` command name collision with `runit`](https://github.com/sveltejs/cli/issues/259)
- [`sv` in windows powershell conflicts with `Set-Variable`](https://github.com/sveltejs/cli/issues/317)
