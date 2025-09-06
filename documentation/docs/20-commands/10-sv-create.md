---
title: sv create
---

`sv create` sets up a new SvelteKit project, with options to [setup additional functionality](sv-add#Official-add-ons).

## Usage

```sh
npx sv create [options] [path]
```

## Options

### `--from-playground <url>`

Create a SvelteKit project from a Svelte playground URL. This downloads the playground code, automatically detects and installs external dependencies, and sets up a complete SvelteKit project structure. External dependencies found in import statements are automatically added to `package.json` and can be installed during project setup.

Example:

```sh
npx sv create --from-playground=https://svelte.dev/playground/hello-world
```

### `--template <name>`

Which project template to use:

- `minimal` — barebones scaffolding for your new app
- `demo` — showcase app with a word guessing game that works without JavaScript
- `library` — template for a Svelte library, set up with `svelte-package`

### `--types <option>`

Whether and how to add typechecking to the project:

- `ts` — default to `.ts` files and use `lang="ts"` for `.svelte` components
- `jsdoc` — use [JSDoc syntax](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) for types

### `--no-types`

Prevent typechecking from being added. Not recommended!

### `--no-add-ons`

Run the command without the interactive add-ons prompt

### `--install <package-manager>`

Installs dependencies with a specified package manager:

- `npm`
- `pnpm`
- `yarn`
- `bun`
- `deno`

### `--no-install`

Prevents installing dependencies.

<!-- ## Programmatic interface

```js
// TODO: this gives type checking errors in the docs site when not commented out. Need to release sv, install it in the site, and uncomment this.
// import { create } from 'sv';

// // todo: check if this is right
// create(cwd, {
// 	// add your options here
// 	// todo: list available option
// });
```
-->
