---
title: devtools-json
---

`devtools-json` is essentially a vite plugin [vite-plugin-devtools-json](https://github.com/ChromeDevTools/vite-plugin-devtools-json/) for generating the Chrome DevTools project settings file on-the-fly in the devserver.

It will prevent this server log:

```sh
Not found: /.well-known/appspecific/com.chrome.devtools.json
```

## Usage

```bash
npx sv add devtools-json
```

## What you get

- the `vite` plugin added to your vite plugin options.
