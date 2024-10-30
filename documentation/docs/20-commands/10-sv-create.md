---
title: sv create
---

`sv create` sets up a new SvelteKit project, with options to [setup additional functionality](sv-add#Official-integrations).

## Usage

```bash
npx sv create [options] [path]
```

## Options

<!-- TODO this flag should probably just be '--types', and the options should be 'ts' or 'jsdoc' -->

### `--check-types <option>`

Whether and how to add typechecking to the project:

- `typescript` — default to `.ts` files and use `lang="ts"` for `.svelte` components
- `checkjs` — use [JSDoc syntax](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) for types
- `none` — no typechecking. Not recommended!

### `--template <name>`

Which project template to use:

- `minimal` — barebones scaffolding for your new app
- `demo` — showcase app with a word guessing game that works without JavaScript
- `library` — template for a Svelte library, set up with `svelte-package`

### `--no-integrations`

<!-- TODO should be renamed to `--no-addons` -->

Run the command without the interactive add-ons prompt

### `--no-install`

Skip dependency installation

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
