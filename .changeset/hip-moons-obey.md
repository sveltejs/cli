---
"sv": minor
---

breaking: key `officialAddons` by add-on id (`sveltekitAdapter` -> `'sveltekit-adapter'`, `betterAuth` -> `'better-auth'`, `aiTools` -> `'ai-tools'`). This also fixes `runsAfter('sveltekitAdapter')` being a silent no-op, and `dependsOn`/`runsAfter` now accept community add-on ids.
