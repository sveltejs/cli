---
'@sveltejs/sv-utils': minor
---

feat(sv-utils): add `pm.allowBuilds` and `pm.version`, deprecate the `pnpm` namespace

```diff
-if (packageManager === 'pnpm') {
-	sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds({ cwd, packages: ['sharp'] }));
-}
+pm.allowBuilds({ sv, file, cwd, packageManager, packages: ['sharp'] });
```
