---
title: sv create
---

`sv create` sets up a new SvelteKit project, with options to [setup additional functionality](sv-add#Official-integrations).

## Usage

```bash
npx sv create
```

```bash
npx sv create ./my/path
```

## Available options

| Option            | option values                 | default    | description                                                |
| ----------------- | ----------------------------- | ---------- | ---------------------------------------------------------- |
| --check-types     | typescript \| checkjs \| none | typescript | determine if type checking should be added to this project |
| --template        | minimal \| library \| demo    | minimal    | project template                                           |
| --no-integrations | -                             | -          | skips interactive integration installer                    |
| --no-install      | -                             | -          | skips installing dependencies                              |

<!--
## Programmatic interface

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
