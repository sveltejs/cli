---
title: prettier
---

[Prettier](https://prettier.io) is an opinionated code formatter.

## Usage

```sh
npx sv add prettier
```

## What you get

- scripts in your `package.json`
- `.prettierignore` and `.prettierrc` files
- updates to your eslint config if you're using that package

## Options

### useTabs

Whether to use tabs for indentation. Default: `yes`

```sh
npx sv add prettier="useTabs:no"
```

### singleQuote

Whether to use single quotes instead of double quotes. Default: `yes`

```sh
npx sv add prettier="singleQuote:no"
```

### trailingComma

Which trailing comma style to use:

- `none` — no trailing commas
- `es5` — where valid in ES5 (objects, arrays)
- `all` — wherever possible

Default: `none`

```sh
npx sv add prettier="trailingComma:es5"
```

### printWidth

The line width at which the printer will wrap. Default: `100`

```sh
npx sv add prettier="printWidth:120"
```

Multiple options can be combined with `+`:

```sh
npx sv add prettier="useTabs:no+singleQuote:no+trailingComma:es5+printWidth:80"
```
