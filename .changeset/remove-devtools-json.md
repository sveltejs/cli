---
'sv': minor
---

remove: `devtools-json` add-on as SvelteKit will [silently 404 Chrome DevTools workspaces request](https://github.com/sveltejs/kit/pull/15656). You can still add `vite-plugin-devtools-json` manually if needed.
