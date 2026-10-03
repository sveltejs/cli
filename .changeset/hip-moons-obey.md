---
"sv": patch
---

fix: Add-on ordering through the API now works with official and community add-ons. Key `officialAddons` by add-on id, using `'sveltekit-adapter'`, `'better-auth'`, and `'ai-tools'` instead of `sveltekitAdapter`, `betterAuth`, and `aiTools`. `dependsOn` and `runsAfter` also accept community add-on ids when those add-ons are included in the same command. The CLI interface is unchanged.
