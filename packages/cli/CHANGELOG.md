# sv

## 0.6.26
### Patch Changes


- fix: insert the `tailwindcss` vite plugin at the start of the plugin array ([#478](https://github.com/sveltejs/cli/pull/478))


- chore: add keywords to library template ([#473](https://github.com/sveltejs/cli/pull/473))

## 0.6.25
### Patch Changes


- chore: detect package manager asynchronously ([#465](https://github.com/sveltejs/cli/pull/465))


- chore: add keys to `{#each}` blocks ([#466](https://github.com/sveltejs/cli/pull/466))


- fix: pass `schema` to `drizzle` client for better type generation ([#459](https://github.com/sveltejs/cli/pull/459))


- fix: addons executed in the wrong order in certain circumstances ([#462](https://github.com/sveltejs/cli/pull/462))

## 0.6.24
### Patch Changes


- fix: use 'prettier' instead of ['flat/prettier'] ([#467](https://github.com/sveltejs/cli/pull/467))


- fix: properly add tailwind plugins on subsequent add-on executions ([#456](https://github.com/sveltejs/cli/pull/456))

## 0.6.23
### Patch Changes


- fix: use `eslint-plugin-svelte` v3 ([#455](https://github.com/sveltejs/cli/pull/455))

## 0.6.22
### Patch Changes


- fix: make `drizzle` next steps more precise ([#447](https://github.com/sveltejs/cli/pull/447))


- chore: update addon dependencies ([#450](https://github.com/sveltejs/cli/pull/450))


- fix: allow selecting adapter auto ([#446](https://github.com/sveltejs/cli/pull/446))


- feat: update `eslint-plugin-svelte` v3 ([#453](https://github.com/sveltejs/cli/pull/453))


- fix: re-add `tailwindcss` plugins ([#448](https://github.com/sveltejs/cli/pull/448))

## 0.6.21
### Patch Changes


- feat: `vitest` use client and server side testing for `kit` ([#311](https://github.com/sveltejs/cli/pull/311))

## 0.6.20
### Patch Changes


- Remove comment about adapter-auto once a specific sveltekit adapter is chosen ([#436](https://github.com/sveltejs/cli/pull/436))


- fix: `onlyBuiltDependencies` not added on new projects ([#439](https://github.com/sveltejs/cli/pull/439))


- fix: generate correct table defintion for `turso` in `lucia` demo ([#433](https://github.com/sveltejs/cli/pull/433))

## 0.6.19
### Patch Changes


- feat: update to `tailwindcss` v4.0.0 ([#422](https://github.com/sveltejs/cli/pull/422))


- feat: support `pnpm` version `10` ([#432](https://github.com/sveltejs/cli/pull/432))

## 0.6.18
### Patch Changes


- fix: `checkjs` library template ([#428](https://github.com/sveltejs/cli/pull/428))

## 0.6.17
### Patch Changes


- fix: properly pass through arguments to `sv check` ([#420](https://github.com/sveltejs/cli/pull/420))


- chore: use `rolldown` instead of `rollup` ([#371](https://github.com/sveltejs/cli/pull/371))

## 0.6.16
### Patch Changes


- fix: ensure Sverdle keyboard events modify game state without a trip to the server if client-side JavaScript is enabled ([#416](https://github.com/sveltejs/cli/pull/416))

## 0.6.15
### Patch Changes


- chore: add prepare script to run `svelte-kit sync` ([#409](https://github.com/sveltejs/cli/pull/409))

## 0.6.14
### Patch Changes


- chore: update `vite@6` and related packages ([#410](https://github.com/sveltejs/cli/pull/410))


- fix: forward exit code of external package commands ([#412](https://github.com/sveltejs/cli/pull/412))

## 0.6.13
### Patch Changes


- chore: update `adapter-auto` and `adapter-cloudflare` ([#401](https://github.com/sveltejs/cli/pull/401))

## 0.6.12
### Patch Changes


- fix: git detection inside preconditions failed ([#394](https://github.com/sveltejs/cli/pull/394))


- chore: update addon dependencies ([#357](https://github.com/sveltejs/cli/pull/357))


- chore: utilize prepack lifecycle script ([#396](https://github.com/sveltejs/cli/pull/396))


- chore: improve cli help menu ([#294](https://github.com/sveltejs/cli/pull/294))


- fix: use modern `Spring` and `MediaQuery` implementation ([#361](https://github.com/sveltejs/cli/pull/361))


- fix: tailwind plugins as dev dependencies ([#400](https://github.com/sveltejs/cli/pull/400))

## 0.6.11
### Patch Changes


- fix: properly add `eslint` dependency ([#375](https://github.com/sveltejs/cli/pull/375))


- feat: migrate to `$app/state` ([#358](https://github.com/sveltejs/cli/pull/358))

## 0.6.10
### Patch Changes


- fix: correctly resolve package manager commands in `create`'s next-steps ([#360](https://github.com/sveltejs/cli/pull/360))


- fix: don't generate sourcemaps for release ([#373](https://github.com/sveltejs/cli/pull/373))


- chore: update-dependencies ([#356](https://github.com/sveltejs/cli/pull/356))


- fix: make `lucia` validation error messages more descriptive ([#363](https://github.com/sveltejs/cli/pull/363))

## 0.6.9
### Patch Changes


- fix: use `vite@5` again due to compatability issues with `vitest@2` (#341) ([#353](https://github.com/sveltejs/cli/pull/353))

## 0.6.8
### Patch Changes


- feat: add `sveltekit-adapter` add-on ([#346](https://github.com/sveltejs/cli/pull/346))

## 0.6.7
### Patch Changes


- fix: updated jsdoc type for `paraglide` demo ([#337](https://github.com/sveltejs/cli/pull/337))


- feat: set app templates to `private` by default ([#343](https://github.com/sveltejs/cli/pull/343))


- chore: upgrade `package-manager-detector` to add Deno support ([#313](https://github.com/sveltejs/cli/pull/313))

## 0.6.6
### Patch Changes


- feat: respect `.gitignore` in `eslint` add-on ([#335](https://github.com/sveltejs/cli/pull/335))


- feat: update `create` templates to Vite 6 ([#340](https://github.com/sveltejs/cli/pull/340))


- fix: add paraglide output directory to `.gitignore` ([#338](https://github.com/sveltejs/cli/pull/338))


- chore: replace svelte-5-preview link ([#327](https://github.com/sveltejs/cli/pull/327))

## 0.6.5
### Patch Changes


- chore: remove `@types/eslint` package from `eslint` add-on ([#323](https://github.com/sveltejs/cli/pull/323))


- chore: remove `aspect-ratio` plugin from `tailwindcss` add-on ([#322](https://github.com/sveltejs/cli/pull/322))


- feat: add short descriptions for each add-on ([#299](https://github.com/sveltejs/cli/pull/299))

## 0.6.4
### Patch Changes


- fix: limit window height of dependency install's output ([#307](https://github.com/sveltejs/cli/pull/307))

## 0.6.3
### Patch Changes


- feat: display package manager output during dependency installs ([#305](https://github.com/sveltejs/cli/pull/305))


- chore: rename `adder` to `add-on` ([#303](https://github.com/sveltejs/cli/pull/303))

## 0.6.2
### Patch Changes


- fix: ignore path prompt if user provided path in `create` ([#292](https://github.com/sveltejs/cli/pull/292))


- feat: add `jsconfig.json` to the 'no type checking' template ([#290](https://github.com/sveltejs/cli/pull/290))


- fix: disable add-on preconditions during `create` ([#288](https://github.com/sveltejs/cli/pull/288))

## 0.6.1
### Patch Changes


- fix: use base32 IDs in lucia add-on ([#262](https://github.com/sveltejs/cli/pull/262))

## 0.6.0
### Minor Changes


- chore: remove routify ([#252](https://github.com/sveltejs/cli/pull/252))


- feat: rename `--check-types <typescript|checkjs|none>` to `--types <ts|js>` with a `--no-types` flag ([#249](https://github.com/sveltejs/cli/pull/249))


### Patch Changes


- fix: update lucia add-on ([#254](https://github.com/sveltejs/cli/pull/254))

## 0.5.11
### Patch Changes


- fix: revert logging dependency install errors ([#244](https://github.com/sveltejs/cli/pull/244))

## 0.5.10
### Patch Changes


- chore: replace mention of `create-svelte` in newly created `README.md` ([#235](https://github.com/sveltejs/cli/pull/235))


- fix: log error when dependency installs fail ([#235](https://github.com/sveltejs/cli/pull/235))


- fix: use `satisfies` instead of `as` in `tailwindcss` config ([#235](https://github.com/sveltejs/cli/pull/235))

## 0.5.9
### Patch Changes


- fix: `tailwindcss` import insertions and execution order ([#221](https://github.com/sveltejs/cli/pull/221))


- fix: adjusted next steps instructions for `create` ([#222](https://github.com/sveltejs/cli/pull/222))

## 0.5.8
### Patch Changes


- fix: quotes in `cd` output if necessary ([#207](https://github.com/sveltejs/cli/pull/207))


- chore: update documentation url hash ([#208](https://github.com/sveltejs/cli/pull/208))


- chore: clarify cli instructions ([#212](https://github.com/sveltejs/cli/pull/212))

## 0.5.7
### Patch Changes


- fix: improve package manager detection ([#178](https://github.com/sveltejs/cli/pull/178))

## 0.5.6
### Patch Changes


- chore: use `svelte@5` full release ([#174](https://github.com/sveltejs/cli/pull/174))

## 0.5.5
### Patch Changes


- feat: create `/demo` page ([#171](https://github.com/sveltejs/cli/pull/171))


- chore: remove auto-installing dependencies ([#164](https://github.com/sveltejs/cli/pull/164))


- feat: add `--version` flag ([#160](https://github.com/sveltejs/cli/pull/160))


- chore: update `silver-fleece` ([#169](https://github.com/sveltejs/cli/pull/169))


- fix: adjust ordering of "next steps" in `create` ([#166](https://github.com/sveltejs/cli/pull/166))


- chore: ensure stack trace is logged ([#172](https://github.com/sveltejs/cli/pull/172))

## 0.5.4
### Patch Changes


- chore: move paraglide demo into seperate page ([#149](https://github.com/sveltejs/cli/pull/149))


- chore: improve unsupported environment message ([#152](https://github.com/sveltejs/cli/pull/152))


- feat: tailwindcss plugins ([#127](https://github.com/sveltejs/cli/pull/127))

## 0.5.3
### Patch Changes


- fix: ensure `lang="ts"` is added in `paraglide` demo ([#145](https://github.com/sveltejs/cli/pull/145))


- fix: rename `auth` handler to `handleAuth` for `lucia` ([#145](https://github.com/sveltejs/cli/pull/145))


- chore: log the external command being executed ([#145](https://github.com/sveltejs/cli/pull/145))


- fix: always add new handlers for hooks ([#145](https://github.com/sveltejs/cli/pull/145))


- fix: better prompt for paraglide langs ([#130](https://github.com/sveltejs/cli/pull/130))


- chore(lucia): update demo to use svelte 5 syntax ([#141](https://github.com/sveltejs/cli/pull/141))

## 0.5.2
### Patch Changes


- fix: improve formatting on new script files ([#96](https://github.com/sveltejs/cli/pull/96))


- fix: dont check preconditions if no add-on selected ([#125](https://github.com/sveltejs/cli/pull/125))


- feat: improved homescreen for adding or creating projects ([#112](https://github.com/sveltejs/cli/pull/112))


- fix: ignore hidden directories in empty directory detection ([#126](https://github.com/sveltejs/cli/pull/126))


- fix: prompt to install dependencies in `sv create` ([#117](https://github.com/sveltejs/cli/pull/117))

## 0.5.1
### Patch Changes


- feat: paraglide add-on ([#67](https://github.com/sveltejs/cli/pull/67))
