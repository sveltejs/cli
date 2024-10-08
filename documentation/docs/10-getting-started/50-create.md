---
title: Create a project
---

## overview

some cool description about the `create` command and it's capabilities

## usage

```bash
npx sv create
```

```bash
npx sv create ./my/path
```

## available options

| Option        | option values                   | default   | description                                                |
| ------------- | ------------------------------- | --------- | ---------------------------------------------------------- |
| --check-types | typescript \| checkjs \| none   | typescipt | determine if type checking should be added to this project |
| --template    | skeleton \| skeletonlib \| demo | skeleton  | project template                                           |
| --no-adders   | -                               | -         | skips interactive adder installer                          |
| --no-install  | -                               | -         | skips installing dependencies                              |

## programatic interface

```js
// todo: this gives error in the docs site when commented in, seems to be related that this package is not published to the registry at this point in time, as it seems to be trying to check types
// import { create } from 'sv';

// // todo: check if this is right
// create(cwd, {
// 	// add your options here
// 	// todo: list available option
// });
```
