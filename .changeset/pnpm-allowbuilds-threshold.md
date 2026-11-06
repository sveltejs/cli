---
'sv-utils': minor
---

feat(sv-utils): tighten the `pnpm.allowBuilds` version thresholds, and expose `pnpm.detectPnpmVersion` as a public api

- `pnpm.allowBuilds` is now a no-op for pnpm `< 10.5` (a settings-only `pnpm-workspace.yaml` breaks `pnpm install` there), keeps the legacy `onlyBuiltDependencies` list up to `10.25`, and writes the `allowBuilds` map from `10.26` on
- `pnpm.detectPnpmVersion(cwd)` is now public, so you can branch on the pnpm version that would run in the target project
- `pnpm.supportsWorkspaceSettings` is deprecated in favor of `pnpm.detectPnpmVersion`
