---
"sv": patch
---

breaking: This affects only users adding add-ons through the API. Key `officialAddons` by add-on id (`sveltekitAdapter` -> `'sveltekit-adapter'`, `betterAuth` -> `'better-auth'`, `aiTools` -> `'ai-tools'`). This fixes `runsAfter('sveltekitAdapter')` silently doing nothing. `dependsOn`/`runsAfter` now also accept community add-on ids, which must be part of the same command. The CLI interface and behavior are unchanged.
