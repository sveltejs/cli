---
title: devtools-json
---

The `devtools-json` add-on installs [`vite-plugin-devtools-json`](https://github.com/ChromeDevTools/vite-plugin-devtools-json/), which is a Vite plugin for generating a Chromium DevTools project settings file on-the-fly in the development server. This file is served from `/.well-known/appspecific/com.chrome.devtools.json` and tells Chromium browsers where your project's source code lives so that you can use [the workspaces feature](https://developer.chrome.com/docs/devtools/workspaces) to edit source files in the browser.

> [!NOTE]
> Installing the plugin enables the feature for all users connecting to the dev server with a Chromium browser, and allows the browser to read and write all files within the directory. If using Chrome's AI Assistance feature, this may also result in data being sent to Google.

You can also prevent the warning for all developers of your application by handling the request yourself. For example, you can create a file named `.well-known/appspecific/com.chrome.devtools.json` with the contents `"Go away, Chrome DevTools!"` or you can add logic to respond to the request in your [`handle`](https://svelte.dev/docs/kit/hooks#Server-hooks-handle) hook:

```js
/// file: src/hooks.server.js
import { dev } from '$app/environment';

export function handle({ event, resolve }) {
  if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
    return new Response(undefined, { status: 404 });
  }
  
  return resolve(event);
}

## Usage

```bash
npx sv add devtools-json
```

## What you get

- `vite-plugin-devtools-json` added to your Vite plugin options
