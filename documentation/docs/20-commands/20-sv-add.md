---
title: sv add
---

`sv add` installs adders to an existing project.

## Usage

```bash
npx sv add
```

```bash
npx sv add tailwindcss
```

```bash
npx sv add tailwindcss --cwd ./my/path
```

## Available options

| Option             | option values                              | default | description                                  |
| ------------------ | ------------------------------------------ | ------- | -------------------------------------------- |
| -C, --cwd          | -                                          | ./      | path to the root of your svelte(kit) project |
| --no-install       | -                                          | -       | skips installing dependencies                |
| --no-preconditions | -                                          | -       | skips checking preconditions                 |
| --no-preconditions | -                                          | -       | skips checking preconditions                 |
| --community        | [community adder names](#community-adders) | -       | adds community adders                        |

## Official adders

- auth
- drizzle
- eslint
- mdsvex
- paraglide
- playwright
- prettier
- routify
- storybook
- tailwindcss
- vitest

## Community adders

> The Svelte maintainers have not reviewed community adders for malicious code. Use at your discretion.

```bash
npx sv add --community # interactive community adder selection
```

```bash
npx sv add --community shadcn-svelte #test
```

```bash
npx sv add --community shadcn-svelte --cwd ./my/path
```

```bash
npx sv add --community npm:your-custom-adder-published-to-npm --cwd ./my/path
```
