---
title: sv kit
---

`sv kit` is a tiny CLI tool that helps you initialize and update your SvelteKit project.

As SvelteKit projects use [Vite](https://vitejs.dev/), you'll mostly be using Vite's CLI commands to build and run your project:
- `vite dev` — start a development server
- `vite build` — build a production version of your app
- `vite preview` — run the production version locally

## Installation

`sv kit` is available in SvelteKit projects, i.e. you will need the `@sveltejs/kit` package to use it. You can use `sv create` to [create and set up](sv-create) a new SvelteKit project. You can also check out SvelteKit's [documentation](/docs/kit) for more information.

## Usage

```bash
npx sv kit sync
```

`sv kit sync` creates the `tsconfig.json` and all generated types (which you can import as `./$types` inside routing files) for your project. When you create a new project, it is listed as the `prepare` script and will be run automatically as part of the npm lifecycle, so you should not ordinarily have to run this command.

You can run this command manually to ensure the generated types and `tsconfig.json` are up to date with your project and configuration. It may also be necessary to run this command as part of your CI pipeline.
