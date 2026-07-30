---
'sv': patch
---

fix(experimental): create manages `#lib` and the rest of the SvelteKit 3 shape

Picking `@sveltejs/kit@next` now produces a project that installs, builds and type-checks: `#lib`
subpath imports instead of `$lib`, a `tsconfig` extending `$app/tsconfig`, and no config options
that don't exist anymore in SvelteKit 3 (`experimental.handleRenderingErrors`, `typescript.config`).
Add-ons that used `typescript.config` to extend `include` now write to the project's `tsconfig`.
