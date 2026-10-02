---
"sv": patch
---

Add-on ordering through the API now works with official and community add-ons. Use add-on ids as keys in `officialAddons`, such as `'sveltekit-adapter'`, `'better-auth'`, and `'ai-tools'`, so `dependsOn` and `runsAfter` can refer to them. Community add-on ids are supported when those add-ons are included in the same command. The CLI interface is unchanged.
