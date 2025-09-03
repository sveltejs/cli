---
'sv': patch
---

internal(core): change `defineAddonOptions({ /*config */ })` to `defineAddonOptions().add('key', { /*config */ }).build()` in order to provide better type safety.
