---
title: sv create
---

## Overview

`sv create` sets up a new SvelteKit project. It also offers numerous integrations with various technologies that are commonly-used for building web sites and web apps. You can set these up later with the `add` command.

## Usage

```bash
npx sv create
```

```bash
npx sv create ./my/path
```

## Available options

| Option        | option values                   | default   | description                                                |
| ------------- | ------------------------------- | --------- | ---------------------------------------------------------- |
| --check-types | typescript \| checkjs \| none   | typescipt | determine if type checking should be added to this project |
| --template    | skeleton \| skeletonlib \| demo | skeleton  | project template                                           |
| --no-adders   | -                               | -         | skips interactive adder installer                          |
| --no-install  | -                               | -         | skips installing dependencies                              |

## programatic interface

```js
// TODO: this gives type checking errors in the docs site when not commented out. Need to release sv, install it in the site, and uncomment this.
// import { create } from 'sv';

// // todo: check if this is right
// create(cwd, {
// 	// add your options here
// 	// todo: list available option
// });
```
