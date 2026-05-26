---
title: stylelint
---

[Stylelint](https://stylelint.io/) is a mighty CSS linter that helps you avoid errors and enforce conventions.

## Usage

```sh
npx sv add stylelint
```

## What you get

- the relevant packages installed including `postcss-html`
- an `stylelint.config.js` file
- updated `.vscode/extensions.json`

## Options

### validate (optional)

Which files Stylelint should validate:

- `svelte` — Validate style tags inside your `.svelte` files (default)
- `css` — Validate your `.css` files (default)
- `sass` — Validate your `.sass` files
- `scss` — Validate your `.scss` files

```sh
npx sv add stylelint="validate:svelte"
```

### plugins (optional)

Whether to add other Stylelint plugins:

- `stylistic` — [`@stylistic/stylelint-plugin`](https://github.com/stylelint-stylistic/stylelint-stylistic)

```sh
npx sv add stylelint="validate:svelte,css+plugins:stylistic"
```

### save (optional)

Configure when Stylelint should run on save.

- `explicit` — Runs every time the user saves the file explicitly, such as through File > Save or Ctrl + S.
- `always` — Runs every time the file saves, regardless of through user interaction of auto save.

```sh
npx sv add stylelint="validate:svelte,css+plugins:stylistic+save:always"
```

### severity

The default warning severity of Stylelint.

- `warn` — Linter warnings should show up as a warning. (default)
- `error` — Linter warnings should show up as an error.

```sh
npx sv add stylelint="validate:svelte,css+plugins:stylistic+save:always+severity:warn"
```
