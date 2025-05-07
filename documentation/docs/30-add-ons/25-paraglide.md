---
title: paraglide
---

[Paraglide from Inlang](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) is a compiler-based i18n library that emits tree-shakable message functions with small bundle sizes, no async waterfalls, full type-safety, and more.

## Usage

```bash
npx sv add paraglide
```

## What you get

- Inlang project settings
- paraglide Vite plugin
- SvelteKit `reroute` and `handle` hooks
- `text-direction` and `lang` attributes in `app.html`
- updated `.gitignore`
- an optional demo page showing how to use paraglide

## Options

### languageTags

The languages you'd like to support specified as IETF BCP 47 language tags.

```bash
npx sv add paraglide="languageTags:en,es"
```

### demo

Whether to generate an optional demo page showing how to use paraglide.

```bash
npx sv add paraglide="demo:yes"
```
