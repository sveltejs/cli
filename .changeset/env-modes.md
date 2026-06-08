---
'@sveltejs/sv-utils': minor
'sv': patch
---

`drizzle` and `better-auth` now emit the declared env API (`src/env.ts` + `$app/env/private`) on kit 3 / `next` or kit 2 with `explicitEnvironmentVariables`, and fall back to legacy `$env/dynamic/private` otherwise. Adds a `defineEnv` helper to `sv-utils`.
