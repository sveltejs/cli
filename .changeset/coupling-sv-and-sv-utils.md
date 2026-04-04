---
'sv': minor
'@sveltejs/sv-utils': minor
---

feat: sv / sv-utils coupling, pnpm helpers, experimental add-ons, and API snapshots

**Highlights**

- Community add-ons are now **experimental**.
- Replace `sv.pnpmBuildDependency` with `sv.file` plus `pnpm.onlyBuiltDependencies` from `@sveltejs/sv-utils` and `file.findUp`.

**`@sveltejs/sv-utils`**

- Add `pnpm.onlyBuiltDependencies` to append packages to `onlyBuiltDependencies` in pnpm YAML via `transforms.yaml`.
- Type `YamlDocument` (`parse.yaml`) with `get` / `set` using `unknown` so consumers narrow explicitly; align YAML transforms with that contract.

**`sv`**

- Refactor workspace / engine / package-manager flows around file IO and package JSON loading (`loadFile`, `saveFile`, `loadPackageJson`), and trim workspace addon path handling; update addons accordingly.
- Reorganize the public `testing` entry for Vitest helpers and document the surface.
- Add generated `api-surface` markdown snapshots and a `scripts/generate-api-surface.js` helper (wired through the build) to track the public API.
- Remove deprecated `pnpmBuildDependency` usage and stop exporting internal pnpm-only-built helpers from the public `sv` surface.
