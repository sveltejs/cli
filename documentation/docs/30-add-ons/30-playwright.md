---
title: playwright
---

[Playwright](https://playwright.dev) browser testing.

## Usage

```sh
npx sv add playwright
```

## What you get

- scripts added in your `package.json`
- a Playwright config file
- an updated `.gitignore`
- an example e2e test
- an optional demo page the e2e test runs against

## Options

### demo

Whether to generate a demo page at `/demo/playwright` (listed in the `DemoLinks` post-it) for the example e2e test. Without it, the test targets `/`.

```sh
npx sv add playwright="demo:yes"
```
