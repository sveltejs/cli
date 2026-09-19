---
"sv": minor
---

breaking: `officialAddons` is now keyed by add-on id, so `sveltekitAdapter`, `betterAuth` and `aiTools` become `'sveltekit-adapter'`, `'better-auth'` and `'ai-tools'`. This also fixes `runsAfter('sveltekitAdapter')` silently doing nothing, and `dependsOn`/`runsAfter` now accept community add-on ids.
