---
title: Overview
---

The command line interface (CLI), `sv`, is a toolkit for creating and maintaining Svelte applications.

## Usage

```sh
npx sv <command> <args>
```

## Commands

- [`sv create`](sv-create) — scaffold a new Sveltekit project, with the option to set up add-ons in one go
- [`sv add`](sv-add) — apply add-ons to an existing project
- [`sv migrate`](sv-migrate) — migrate your Svelte(Kit) codebase between versions
- [`sv check`](sv-check) — analyze your code with [svelte-check](https://github.com/sveltejs/language-tools)

Run `sv <command> --help` to see all options for a command.

## Add-ons

An add-on is a pre-packaged integration that applies itself to your project: it installs dependencies, writes config files, and may ask follow-up questions (like which database to use).

There are two types:

- **Official add-ons** are developed and maintained in the [Svelte CLI repository](https://github.com/sveltejs/cli) by the Svelte team, and have been vetted for both quality and safety. They're a deliberately small set of widely used, best-in-class integrations. See the [full list of official add-ons](sv-add#Official-add-ons).
- **Community add-ons** are npm packages published by the community, letting any library or tool become a one-liner install with `npx sv add my-addon`. Svelte maintainers have not reviewed them for malicious code — see the [community add-ons docs](sv-add#Community-add-ons) for how to find and install them.

Want to make your own add-on? Follow the [create your own guide](community).

## Acknowledgements

Thank you to [Christopher Brown](https://github.com/chbrown) who originally owned the `sv` name on npm for graciously allowing it to be used for the Svelte CLI. You can find the original `sv` package at [`@chbrown/sv`](https://www.npmjs.com/package/@chbrown/sv).
