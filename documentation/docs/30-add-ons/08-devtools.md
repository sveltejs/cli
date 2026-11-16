---
title: devtools
---

[Vite DevTools](https://devtools.vite.dev) provides an in-page development dock. The add-on also installs [Svelte DevTools](https://github.com/baseballyama/vite-devtools-svelte), which adds Svelte component, reactivity, routing, and performance inspection to the dock.

## Usage

```sh
npx sv add devtools
```

## What you get

- `@vitejs/devtools`, its Vite inspection tool, and `vite-devtools-svelte` installed as development dependencies
- the Vitest inspection tool when the `vitest` add-on is installed
- both plugins added to your Vite config in the required order
- Svelte inspection panels in the Vite DevTools dock
- direct access to the Svelte panels at `/.svelte-devtools/`
- an MCP endpoint for development-time Svelte diagnostics
