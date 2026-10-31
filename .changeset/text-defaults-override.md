---
"@sveltejs/sv-utils": minor
---

feat: add `text.add` and `text.set`, deprecate `text.upsert`

`text.upsert` is now deprecated in favor of `text.add` to better reflect its behaviour:
 - `text.add` – Appends the value if missing (replaces `text.upsert`)
 - `text.set` – Sets or overwrites the value regardless of its presence
