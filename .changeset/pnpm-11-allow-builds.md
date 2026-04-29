---
'@sveltejs/sv-utils': patch
---

handle `pnpm@11`: add `allowBuilds` helper that auto-detects the installed pnpm version and writes to `allowBuilds` (pnpm 11+) or the legacy `onlyBuiltDependencies` list (pnpm 10). Deprecate `onlyBuiltDependencies`
