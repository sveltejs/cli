---
'@sveltejs/sv-utils': minor
---

fix(sv-utils): detect pnpm version from the target project, and update `pnpm.allowBuilds` signature.

```diff
-pnpm.allowBuilds('sharp')
+pnpm.allowBuilds({ cwd, packages: ['sharp'] })
```
