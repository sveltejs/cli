# sv

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
