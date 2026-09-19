---
title: enhanced-img
---

[`@sveltejs/enhanced-img`](https://svelte.dev/docs/kit/images) serves smaller file formats like `avif` or `webp`, generates the right sizes for different devices, and sets `width` and `height` to avoid layout shift.

## Usage

```sh
npx sv add enhanced-img
```

## What you get

- the `enhancedImages` Vite plugin
- `<img>` tags bound to a static image import rewritten to `<enhanced:img>`
- `sharp` added to the allowed builds when using pnpm
