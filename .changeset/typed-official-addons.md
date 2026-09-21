---
'sv': minor
---

feat: type the options of official add-ons. `officialAddons` is no longer widened to `Addon<any>`, so `add({ addons, options })` checks add-on options instead of accepting anything.
