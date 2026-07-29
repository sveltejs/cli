---
'sv': patch
---

fix(experimental): create manages `#lib` and the rest of the SvelteKit 3 shape

Picking `@sveltejs/kit@next` now produces a project that installs, builds and type-checks: `#lib`
subpath imports instead of `$lib`, `tsconfig` extending `$app/tsconfig`, and no options SvelteKit 3
removed.
