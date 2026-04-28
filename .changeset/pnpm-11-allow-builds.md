---
'@sveltejs/sv-utils': patch
---

prepare for `pnpm@11`: add `pnpm.allowBuilds` helper that auto-detects the installed pnpm version and writes to `allowBuilds` (pnpm 11+) or the legacy `onlyBuiltDependencies` list (pnpm 10). Deprecate `pnpm.onlyBuiltDependencies`
