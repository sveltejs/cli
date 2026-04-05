---
title: devtools-json
---

The `devtools-json` add-on adds a [`handle`](https://svelte.dev/docs/kit/hooks#Server-hooks-handle) hook that responds to the `/.well-known/appspecific/com.chrome.devtools.json` request with a 404 (aka `"Go away, Chrome DevTools!"`) during development, preventing the notice in your server logs.

## Alternatives

If you'd prefer to disable the feature in your browser instead, you can do this in Chrome by visiting `chrome://flags` and disabling the "DevTools Project Settings". You may also be interested in disabling "DevTools Automatic Workspace Folders" since it's closely related.

If you want to enable [the workspaces feature](https://developer.chrome.com/docs/devtools/workspaces) instead, you can install [`vite-plugin-devtools-json`](https://github.com/ChromeDevTools/vite-plugin-devtools-json/), which is a Vite plugin for generating the project settings file on-the-fly in the development server:

```js
/// file: vite.config.js
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), devtoolsJson()]
});
```

> [!NOTE]
> Installing the plugin enables the feature for all users connecting to the dev server with a Chromium browser, and allows the browser to read and write all files within the directory. If you are using Chrome's AI Assistance feature, this may also result in data being sent to Google.

## Usage

```sh
npx sv add devtools-json
```

## What you get

- A `handleDevtoolsJson` handle function added to your `hooks.server` file
