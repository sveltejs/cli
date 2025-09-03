---
'sv': patch
---

internal(core): remove `defineAddonOptions({ /*config */ })` in favor of `prepareAddonOptions().add('key', { /*config */ }).build()`. This change brings better type safety.
