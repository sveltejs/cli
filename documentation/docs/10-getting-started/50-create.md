---
title: Create a project
---

## create

some cool description about the `create` command and it's capabilities

## usage

```
npx sv create
```

```
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
// todo: this gives error in the docs site when commented in
// import { create } from 'sv';

// // todo: check if this is right
// create(cwd, {
// 	// add your options here
// 	// todo: list available option
// });
```
