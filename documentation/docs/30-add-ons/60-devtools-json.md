---
title: devtools-json
---

[`vite-plugin-devtools-json`](https://github.com/ChromeDevTools/vite-plugin-devtools-json/) is a Vite plugin for generating a Chromium DevTools project settings file on-the-fly in the development server. This file is served from `/.well-known/appspecific/com.chrome.devtools.json` and tells Chromium browsers where your project's source code lives so that you can use [the workspaces feature](https://developer.chrome.com/docs/devtools/workspaces) to edit source files in the browser.

## Usage

```bash
npx sv add devtools-json
```

## What you get

- `vite-plugin-devtools-json` added to your Vite plugin options
