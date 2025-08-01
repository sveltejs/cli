---
title: devtools-json
---

The `devtools-json` add-on installs [`vite-plugin-devtools-json`](https://github.com/ChromeDevTools/vite-plugin-devtools-json/), which is a Vite plugin for generating a Chromium DevTools project settings file on-the-fly in the development server. This file is served from `/.well-known/appspecific/com.chrome.devtools.json` and tells Chromium browsers where your project's source code lives so that you can use [the workspaces feature](https://developer.chrome.com/docs/devtools/workspaces) to edit source files in the browser.

> [!NOTE]
> Installing the plugin enables the feature for all users connecting to the dev server with a Chromium browser, and allows the browser to read and write all files within the directory. If using Chrome's AI Assistance feature, this may also result in data being sent to Google.

## Alternatives

If you'd prefer not to install the plugin, but still want to avoid seeing a message about the missing file, you have a couple of options.

Firstly, you can prevent the request from being issued on your machine by disabling the feature in your browser. You can do this in Chrome by visiting `chrome://flags` and disabling the "DevTools Project Settings". You may also be interested in disabling "DevTools Automatic Workspace Folders" since it’s closely related.

You can also prevent the web server from issuing a notice regarding the incoming request for all developers of your application by handling the request yourself. For example, you can create a file named `.well-known/appspecific/com.chrome.devtools.json` with the contents `"Go away, Chrome DevTools!"` or you can add logic to respond to the request in your [`handle`](https://svelte.dev/docs/kit/hooks#Server-hooks-handle) hook:

```js
/// file: src/hooks.server.js
import { dev } from '$app/environment';

export function handle({ event, resolve }) {
	if (dev && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response(undefined, { status: 404 });
	}

	return resolve(event);
}
```

## Usage

```sh
npx sv add devtools-json
```

## What you get

- `vite-plugin-devtools-json` added to your Vite plugin options
