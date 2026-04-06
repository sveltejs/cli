---
'sv': minor
'@sveltejs/sv-utils': minor
---

feat: decouple sv / sv-utils, explicit public API, deprecation pass

**`@sveltejs/sv-utils`**

- Rename file helpers: `readFile` -> `loadFile`, `writeFile` -> `saveFile`, `getPackageJson` -> `loadPackageJson`
- Add `pnpm.onlyBuiltDependencies()` transform for `pnpm-workspace.yaml`
- Export `YamlDocument` type from parsers
- Remove `commonFilePaths`, `installPackages` (moved internal to `sv`)

**`sv`**

- `create()` signature changed to `create({ cwd, ...options })`. The old `create(cwd, options)` form still works but is deprecated and will be removed in the next major.
- `sv.pnpmBuildDependency()` is deprecated. Use `sv.file()` with `pnpm.onlyBuiltDependencies()` from `@sveltejs/sv-utils` instead. Still works for now.
- `workspace.file.prettierignore`, `.prettierrc`, `.eslintConfig`, `.vscodeSettings`, `.vscodeExtensions` are deprecated. Use the raw strings directly (e.g. `'.prettierignore'`). Still works for now.
- Add `workspace.file.findUp()` to locate files by walking up the directory tree.
- Make type exports explicit (no more `export type *`). Removed types that were never part of the intended public API: `PackageDefinition`, `Scripts`, `TestDefinition`.
- Remove `setup`, `createProject`, `startPreview`, `addPnpmBuildDependencies` from `sv/testing` exports.
- Add `api-surface.md` snapshots (auto-generated on build) to track the public API of `sv` and `@sveltejs/sv-utils`.
