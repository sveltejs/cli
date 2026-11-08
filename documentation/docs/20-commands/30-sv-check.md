---
title: sv check
---

`sv check` runs [`svelte-check`](https://npmx.dev/package/svelte-check) in your project and reports errors and warnings such as unused CSS, accessibility hints, and JavaScript/TypeScript compiler errors.

It runs `svelte-check` through your project's package manager, so the package must be installed locally:

```sh
npm i -D svelte-check
npx sv check
```

## Options

All [`svelte-check` options](https://npmx.dev/package/svelte-check) are forwarded, plus:

### `-C`, `--cwd <path>`

Path to the root of your project. Defaults to the current working directory.
