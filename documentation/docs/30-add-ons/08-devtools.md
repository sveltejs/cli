---
title: devtools
---

[Vite DevTools](https://devtools.vite.dev) provides an in-page development dock. The add-on also installs [Svelte DevTools](https://github.com/sveltejs/vite-devtools-svelte), which adds Svelte component, reactivity, routing, and performance inspection to the dock.

## Usage

```sh
npx sv add devtools
```

## What you get

- `@vitejs/devtools`, the selected inspection tools, and `@sveltejs/vite-devtools-svelte` installed as development dependencies
- both plugins added to your Vite config in the required order
- client authentication explicitly enabled in the Vite DevTools config (set `clientAuth` to `false` to disable it)
- Svelte inspection panels in the Vite DevTools dock
- direct access to the Svelte panels at `/.svelte-devtools/`
- an MCP endpoint for development-time Svelte diagnostics

## Options

### plugins

Which Vite DevTools plugins to install:

- `vitest`
- `rolldown`
- `vite`
- `oxc`

Vitest, Rolldown, and Vite are selected by default.

```sh
npx sv add devtools="plugins:vitest,oxc,rolldown,vite"
```
