---
"sv": patch
---

fix: scope `@deprecated` tag to the legacy `create(cwd, options)` overload

The JSDoc `@deprecated` on the first overload signature caused editors to
mark the entire `create` export as deprecated, including the supported
`create({ cwd, ...options })` call. Reorder the overloads so the
non-deprecated signature comes first; editors now only strike through the
legacy positional form.

Closes #1063
