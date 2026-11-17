---
'sv': patch
---

fix(migrate): keep `undefined` in generated dynamic env schemas (`input => input`), so `A ?? B` fallbacks keep working
