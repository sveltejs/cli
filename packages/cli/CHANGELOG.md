# sv

## 0.10.1
### Patch Changes


- fix(cli): avoid printing duplicated `--no-install` flag ([#803](https://github.com/sveltejs/cli/pull/803))

## 0.10.0
### Minor Changes


- feat(cli): `npx sv create` now supports a new argument `--add` to add add-ons to the project in the same command. ([#695](https://github.com/sveltejs/cli/pull/695))


### Patch Changes


- feat(cli): show args used so that you can run the cli without any prompt next time ([#695](https://github.com/sveltejs/cli/pull/695))

## 0.9.15
### Patch Changes


- fix(tailwind): update vscode setting `files.associations` to `tailwindcss` ([#796](https://github.com/sveltejs/cli/pull/796))


- feat(cli): add `--no-dir-check` option to `sv create`. With this flag, even if the folder is not empty, no prompt will be shown ([#785](https://github.com/sveltejs/cli/pull/785))


- feat(mcp): include an `AGENTS.md` or similar when using the `mcp` addon ([#777](https://github.com/sveltejs/cli/pull/777))


- feat(vitest): when `add vitest` is used within a project that uses vitest@3, the addon will display some next steps to finalize the migration to vitest@4 ([#797](https://github.com/sveltejs/cli/pull/797))


- fix(demo): rewrite relative import extensions to JavaScript equivalents _(`tsconfig.json` update)_ ([#801](https://github.com/sveltejs/cli/pull/801))

## 0.9.14
### Patch Changes


- feat(tailwind): add vscode setting for tailwind ([#780](https://github.com/sveltejs/cli/pull/780))


- feat(cli): wrap links with `resolve()` function to follow [best practices](https://svelte.dev/docs/kit/$app-paths#resolve) ([#754](https://github.com/sveltejs/cli/pull/754))


- feat(create): co-locate css file from usage (`layout.css` & `+layout.svelte`) ([#780](https://github.com/sveltejs/cli/pull/780))


- fix(mcp): Add schema definition for Gemini MCP configuration. ([#774](https://github.com/sveltejs/cli/pull/774))

## 0.9.13
### Patch Changes


- chore(create): add div with `display: contents` to library template ([#773](https://github.com/sveltejs/cli/pull/773))


- fix(mcp): generate valid `mcp` local configuration for `opencode` ([#769](https://github.com/sveltejs/cli/pull/769))


- feat(demo): include file extensions for local imports ([#757](https://github.com/sveltejs/cli/pull/757))

## 0.9.12
### Patch Changes


- feat(vitest): update to vitest `4.0` ([#760](https://github.com/sveltejs/cli/pull/760))
  
  - removing `@vitest/browser` in favor of `@vitest/browser-playwright`
  - run browser tests in headless mode

- fix(cli): Check existing conditions for specified options ([#771](https://github.com/sveltejs/cli/pull/771))

## 0.9.11
### Patch Changes


- fix(prettier): add tailwindcss plugin to prettier config if tailwindcss is installed ([#756](https://github.com/sveltejs/cli/pull/756))


- fix(cli): generating closing </script> tags now works correctly ([#763](https://github.com/sveltejs/cli/pull/763))

## 0.9.10
### Patch Changes


- chore(cli): bump defaults versions ([#744](https://github.com/sveltejs/cli/pull/744))


- feat(drizzle): update docker pgdata volume for postgres 18 ([#749](https://github.com/sveltejs/cli/pull/749))


- feat(cli): workspace now gives `files` object with `viteConfig` and `svelteConfig` paths to be used in add-ons ([#755](https://github.com/sveltejs/cli/pull/755))


- fix(cli): `+layout.svelte` doesn't use optional chaining now ([#753](https://github.com/sveltejs/cli/pull/753))

## 0.9.9
### Patch Changes


- fix(drizzle): `--cwd` option in `add` command is now taken into account ([#738](https://github.com/sveltejs/cli/pull/738))


- feat(drizzle): Docker Compose file is now stored in `compose.yaml` instead of `docker-compose.yml` ([#738](https://github.com/sveltejs/cli/pull/738))


- fix(add): include monorepo root in dependency detection ([#740](https://github.com/sveltejs/cli/pull/740))


- feat(cli): add new add-on `mcp` to configure your project ([#735](https://github.com/sveltejs/cli/pull/735))


- feat(cli): `--from-playground` will now bring a PlaygroundLayout to get a more consistent experience with the online playground ([#731](https://github.com/sveltejs/cli/pull/731))

## 0.9.8
### Patch Changes


- fix(tailwindcss): add `@tailwindcss/oxide` to approve-builds in `pnpm` ([#717](https://github.com/sveltejs/cli/pull/717))


- feat(drizzle): user ID is now a string to ease migration to auth ([#733](https://github.com/sveltejs/cli/pull/733))


- feat(cli): pnpm config will now be stored in `pnpm-workspace.yaml` (e.g. `onlyBuiltDependencies`) ([#717](https://github.com/sveltejs/cli/pull/717))

## 0.9.7
### Patch Changes


- fix(cli): export types ([#719](https://github.com/sveltejs/cli/pull/719))


- chore(cli): improve `typescript` detection ([#710](https://github.com/sveltejs/cli/pull/710))


- chore(cli): bump defaults versions ([#722](https://github.com/sveltejs/cli/pull/722))


- fix(cli): `--from-playground` will create projects with `experimental.async` enabled _(if svelte version allows it)_ ([#729](https://github.com/sveltejs/cli/pull/729))


- fix(cli): `--from-playground` option now works correctly from node 20 ([#720](https://github.com/sveltejs/cli/pull/720))

## 0.9.6
### Patch Changes


- fix(vitest): now import `defineConfig` from `vitest/config` ([#703](https://github.com/sveltejs/cli/pull/703))

## 0.9.5
### Patch Changes


- feat(cli): create projects from the svelte playground with `npx sv create --from-playground <url>` ([#662](https://github.com/sveltejs/cli/pull/662))


- chore(cli): speedup internal tests ([#698](https://github.com/sveltejs/cli/pull/698))


- chore(core): streamline object helpers ([#685](https://github.com/sveltejs/cli/pull/685))


- fix(eslint): update eslint to `^9.22.0` and use `defineConfig` from `eslint/config` _(to fix a deprecation warning)_ ([#712](https://github.com/sveltejs/cli/pull/712))


- fix(eslint): add `@types/node` in devDependencies ([#711](https://github.com/sveltejs/cli/pull/711))

## 0.9.4
### Patch Changes


- chore(addons): change some dependencies to devDependencies ([#682](https://github.com/sveltejs/cli/pull/682))


- fix(add): allow passing add-on as argument that depends on another add-on ([#691](https://github.com/sveltejs/cli/pull/691))


- fix: improve add-on option types ([#692](https://github.com/sveltejs/cli/pull/692))

## 0.9.3
### Patch Changes


- chore(core): change `defineAddonOptions({ /*config */ })` to `defineAddonOptions().add('key', { /*config */ }).build()` in order to provide better type safety. ([#686](https://github.com/sveltejs/cli/pull/686))


- fix(migrate): allow `migrate` to run without specifying a migration arg ([#676](https://github.com/sveltejs/cli/pull/676))


- fix(add): improve robustness of add-on args parsing ([#681](https://github.com/sveltejs/cli/pull/681))

## 0.9.2
### Patch Changes


- fix(cli): `vite.config.*` file detection works for both .js and .ts variants ([#673](https://github.com/sveltejs/cli/pull/673))

## 0.9.1
### Patch Changes


- chore(create): recommend the `kit.typescript.config` setting instead of copying from the generated config ([#668](https://github.com/sveltejs/cli/pull/668))


- chore(devtools-json): update `vite-plugin-devtools-json` ([#667](https://github.com/sveltejs/cli/pull/667))

## 0.9.0
### Minor Changes


- feat(cli): rework preconditions: ([#650](https://github.com/sveltejs/cli/pull/650))
  
  - remove `--no-preconditions` option from `sv add`
  - add `--no-git-check` option to `sv add`. With this flag, even if some files are dirty, no prompt will be shown

### Patch Changes


- fix(create): update library docs to reflect proper `pack` command ([#655](https://github.com/sveltejs/cli/pull/655))

## 0.8.21
### Patch Changes


- feat: `vitest` require assertions ([#647](https://github.com/sveltejs/cli/pull/647))


- fix: handle `satisfies` keyword for `vite.addPlugin` ([#653](https://github.com/sveltejs/cli/pull/653))


- chore: remove `git init` next step when creating a new project ([#645](https://github.com/sveltejs/cli/pull/645))


- feat: improve minimal template ([#643](https://github.com/sveltejs/cli/pull/643))
  
  - move `favicon.svg` to `src/lib/assets` folder (to show inline/immutable assets)
  - add `static/robots.txt` (to keep static folder)
  - add `routes/+layout.svelte` (to show layout)

- feat(drizzle): add `db:generate` script to `package.json` ([#648](https://github.com/sveltejs/cli/pull/648))

## 0.8.20
### Patch Changes


- fix: align project steps ([#644](https://github.com/sveltejs/cli/pull/644))


- chore: allow passing an array of import names to imports.addNamed ([#639](https://github.com/sveltejs/cli/pull/639))


- feat: add `vite.addPlugin` to simplify adding a plugin on various vite config styles ([#633](https://github.com/sveltejs/cli/pull/633))

## 0.8.19
### Patch Changes


- feat: combine next steps prompt for `create` ([#637](https://github.com/sveltejs/cli/pull/637))


- chore: use `create-storybook` instead of `storybook init` ([#638](https://github.com/sveltejs/cli/pull/638))


- feat: print warning if using Node.js version below 18.3 ([#625](https://github.com/sveltejs/cli/pull/625))


- fix(tailwindcss): ensure `tailwindStylesheet` is added to `.prettierrc`, when applicable ([#636](https://github.com/sveltejs/cli/pull/636))

## 0.8.18
### Patch Changes


- feat: update templates to vite 7 and vite-plugin-svelte 6 ([#629](https://github.com/sveltejs/cli/pull/629))

## 0.8.17
### Patch Changes


- fix(add): add `/drizzle/` folder to `.prettierignore` if `prettier` is installed when adding `drizzle` addon ([#623](https://github.com/sveltejs/cli/pull/623))


- fix: update `static/` to `/static/` in `.prettierignore` ([#624](https://github.com/sveltejs/cli/pull/624))

## 0.8.16
### Patch Changes


- chore: use plain-text svg favicon ([#617](https://github.com/sveltejs/cli/pull/617))


- fix(add): add `static` folder to `.prettierignore` ([#618](https://github.com/sveltejs/cli/pull/618))

## 0.8.15
### Patch Changes


- fix: resolve to `task` instead of `run` in addon instructions for `deno` ([#599](https://github.com/sveltejs/cli/pull/599))

## 0.8.14
### Patch Changes


- fix: preserve comments when parsing JS AST ([#609](https://github.com/sveltejs/cli/pull/609))

## 0.8.13
### Patch Changes


- chore: don't select `devtools-json` by default ([#598](https://github.com/sveltejs/cli/pull/598))

## 0.8.12
### Patch Changes


- feat(vitest): support vite browser mode ([#588](https://github.com/sveltejs/cli/pull/588))

## 0.8.11
### Patch Changes


- fix(eslint): generated import order are now sorted alphabetically ([#592](https://github.com/sveltejs/cli/pull/592))


- feat: add `devtools-json` addon (using `vite-plugin-devtools-json`) ([#581](https://github.com/sveltejs/cli/pull/581))

## 0.8.10
### Patch Changes


- chore: update lucia template ([#586](https://github.com/sveltejs/cli/pull/586))

## 0.8.9
### Patch Changes


- fix(vitest): unpin vitest to ^3.2.3 after it fixed a regression ([#587](https://github.com/sveltejs/cli/pull/587))

## 0.8.8
### Patch Changes


- fix(vitest): `mount(...)` not available ([#584](https://github.com/sveltejs/cli/pull/584))

## 0.8.7
### Patch Changes


- fix: removed unused import in `drizzle` schema to fix lint ([#571](https://github.com/sveltejs/cli/pull/571))


- fix: add null check for `kit` in the `drizzle` add-on's setup ([#574](https://github.com/sveltejs/cli/pull/574))

## 0.8.6
### Patch Changes


- fix: account for Node `current` releases with even majors when resolving `@types/node` version ([#565](https://github.com/sveltejs/cli/pull/565))

## 0.8.5
### Patch Changes


- fix: directory selection placeholder value was taken as folder path ([#564](https://github.com/sveltejs/cli/pull/564))

## 0.8.4
### Patch Changes


- fix: lucia require user redirect moved to auth guard function ([#558](https://github.com/sveltejs/cli/pull/558))


- feat: expose `runsAfter` to add-ons ([#554](https://github.com/sveltejs/cli/pull/554))

## 0.8.3
### Patch Changes


- fix: always add `storybook` after all other add-ons ([#547](https://github.com/sveltejs/cli/pull/547))


- security: upgrade vite to avoid CVE-2025-32395 ([#548](https://github.com/sveltejs/cli/pull/548))

## 0.8.2
### Patch Changes


- fix: rename Cloudflare adapter option from `cloudflare-pages` to `cloudflare` ([#545](https://github.com/sveltejs/cli/pull/545))


- chore: update `adapter-auto` ([#542](https://github.com/sveltejs/cli/pull/542))


- fix: add `@types/node` as a dev dependency to the `drizzle` and `storybook` add-ons ([#541](https://github.com/sveltejs/cli/pull/541))


- fix: use connection pool when using mysql2 with `drizzle` ([#537](https://github.com/sveltejs/cli/pull/537))

## 0.8.1
### Patch Changes


- feat: adds `--install <package-manager>` flag to `create` and `add` ([#531](https://github.com/sveltejs/cli/pull/531))


- fix: warn on an unparsable `.prettierrc` config file ([#527](https://github.com/sveltejs/cli/pull/527))


- chore: remove redundant `ignores` property in `eslint` config ([#533](https://github.com/sveltejs/cli/pull/533))

## 0.8.0
### Minor Changes


- feat: remove `adapter-cloudflare-workers` and upgrade other adapters ([#520](https://github.com/sveltejs/cli/pull/520))


### Patch Changes


- security: Upgrade Vite to avoid CVE-2025-31125 ([#517](https://github.com/sveltejs/cli/pull/517))


- security: upgrade vite to avoid CVE-2025-31486 ([#522](https://github.com/sveltejs/cli/pull/522))

## 0.7.2
### Patch Changes


- chore: added GitHub official logo to demo template ([#508](https://github.com/sveltejs/cli/pull/508))

## 0.7.1
### Patch Changes


- fix: package manager detection in non interactive environments ([#503](https://github.com/sveltejs/cli/pull/503))

## 0.7.0
### Minor Changes


- feat: enhanced code generation for more intuitive formatting ([#380](https://github.com/sveltejs/cli/pull/380))


- chore: switch to `estree` compatible ast tooling ([#380](https://github.com/sveltejs/cli/pull/380))


### Patch Changes


- chore: use writable derived in sverdle `demo` project ([#500](https://github.com/sveltejs/cli/pull/500))


- chore: disable `no-undef` ESLint rule in TypeScript project ([#483](https://github.com/sveltejs/cli/pull/483))


- chore: replace `create-svelte` in library template readme ([#499](https://github.com/sveltejs/cli/pull/499))

## 0.6.27
### Patch Changes


- chore: updates the paraglide-js addon to setup v2 of paraglide-js ([#461](https://github.com/sveltejs/cli/pull/461))


- fix: add bun lockfiles to `.prettierignore` ([#492](https://github.com/sveltejs/cli/pull/492))


- fix: add volumes to docker compose files generated by `drizzle` ([#475](https://github.com/sveltejs/cli/pull/475))

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
