# @sveltejs/sv-utils

## 0.2.1
### Patch Changes


- add `minVersion` & `coerceVersion` from `semver`. Deprecate `splitVersion` ([#1069](https://github.com/sveltejs/cli/pull/1069))


- handle `pnpm@11`: add `pnpm.allowBuilds` helper that auto-detects the installed pnpm version and writes to `allowBuilds` (pnpm 11+) or the legacy `onlyBuiltDependencies` list (pnpm 10). Deprecate `pnpm.onlyBuiltDependencies` ([#1074](https://github.com/sveltejs/cli/pull/1074))


- improve `svelte` version detection ([#1075](https://github.com/sveltejs/cli/pull/1075))

## 0.2.0
### Minor Changes


- feat: decouple sv / sv-utils, explicit public API, deprecation pass ([#1046](https://github.com/sveltejs/cli/pull/1046))
  
  **`@sveltejs/sv-utils`**
  
  - Rename file helpers: `readFile` -> `loadFile`, `writeFile` -> `saveFile`, `getPackageJson` -> `loadPackageJson`
  - Add `pnpm.onlyBuiltDependencies()` transform for `pnpm-workspace.yaml`
  - Export `YamlDocument` type from parsers
  - Remove `commonFilePaths`, `installPackages` (moved internal to `sv`)
  
  **`sv`**
  
  - `create()` signature changed to `create({ cwd, ...options })`. The old `create(cwd, options)` is deprecated and will be removed in the next major release.
  - `sv.pnpmBuildDependency()` is deprecated and will be removed in the next major release. Use `sv.file()` with `pnpm.onlyBuiltDependencies()` from `@sveltejs/sv-utils` instead.
  - `workspace.file.prettierignore`, `.prettierrc`, `.eslintConfig`, `.vscodeSettings`, `.vscodeExtensions` are deprecated and will be removed in the next major release. Use the raw strings directly (e.g. `'.prettierignore'`).
  - Add `workspace.file.findUp()` to locate files by walking up the directory tree.
  - Add `api-surface.md` snapshots (auto-generated on build) to track the public API of `sv` and `@sveltejs/sv-utils`.
  - Remove `setup`, `createProject`, `startPreview`, `addPnpmBuildDependencies` from `sv/testing` exports.
  - Make type exports explicit (no more `export type *`). Removed types that were never part of the intended public API: `PackageDefinition`, `Scripts`, `TestDefinition`.

- feat: replace `sv.pnpmBuildDependency` with `sv.file` + `pnpm.onlyBuiltDependencies` helper and `file.findUp` ([#1037](https://github.com/sveltejs/cli/pull/1037))


### Patch Changes


- fix: `svelte.addFragment` now accept types ([#1049](https://github.com/sveltejs/cli/pull/1049))

## 0.1.0
### Minor Changes


- feat: community add-ons are now **experimental** ([#1020](https://github.com/sveltejs/cli/pull/1020))

## 0.0.5
### Patch Changes


- feat(sv-utils): all semantic colors now accept `string | string[]` ([#1024](https://github.com/sveltejs/cli/pull/1024))

## 0.0.4
### Patch Changes


- refactor: move files utilities to `@sveltejs/sv-utils` ([#1002](https://github.com/sveltejs/cli/pull/1002))


- feat: add `transform` api to simplify add-on creation ([#1001](https://github.com/sveltejs/cli/pull/1001))

## 0.0.3
### Patch Changes


- feat: add color `hidden` ([#966](https://github.com/sveltejs/cli/pull/966))

## 0.0.2
### Patch Changes


- fix: more robust handling of non-idiomatic Vite configs ([#942](https://github.com/sveltejs/cli/pull/942))


- feat: creation of `@sveltejs/sv-utils` to build addons _(experimental)_ ([#917](https://github.com/sveltejs/cli/pull/917))
