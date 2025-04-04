# svelte-migrate

## 1.10.1
### Patch Changes


- fix: dynamically suggest package manager installation command in `migrate` scripts ([#495](https://github.com/sveltejs/cli/pull/495))

## 1.10.0
### Minor Changes


- feat: added `app-state` migration into `svelte-5` migration ([#494](https://github.com/sveltejs/cli/pull/494))

## 1.9.0
### Minor Changes


- feat: add ability to select migration to run ([#376](https://github.com/sveltejs/cli/pull/376))


### Patch Changes


- chore: align dependencies with `sv` ([#376](https://github.com/sveltejs/cli/pull/376))

## 1.8.0
### Minor Changes


- feat: allow sub path migration or none at all for Svelte 5 migration ([#391](https://github.com/sveltejs/cli/pull/391))

## 1.7.1
### Patch Changes


- chore: update-dependencies ([#356](https://github.com/sveltejs/cli/pull/356))

## 1.7.0
### Minor Changes


- feat: add app-state migration ([#354](https://github.com/sveltejs/cli/pull/354))


### Patch Changes


- docs: add `self-closing-tags` migration ([#349](https://github.com/sveltejs/cli/pull/349))

## 1.6.9
### Patch Changes


- fix: update `@sveltejs/package` to avoid `peerDependencies` warning ([#282](https://github.com/sveltejs/cli/pull/282))


- chore: update repository information ([#274](https://github.com/sveltejs/cli/pull/274))

## 1.6.8
### Patch Changes


- fix: prevent duplicate imports ([#12931](https://github.com/sveltejs/kit/pull/12931))

## 1.6.7
### Patch Changes


- fix: prefer TS in unclear migration situations if `tsconfig.json` found ([#12881](https://github.com/sveltejs/kit/pull/12881))

## 1.6.6
### Patch Changes


- docs: update URLs for new svelte.dev site ([#12857](https://github.com/sveltejs/kit/pull/12857))

## 1.6.5
### Patch Changes


- docs: demonstrate sv migrate over prior commands ([#12840](https://github.com/sveltejs/kit/pull/12840))


- fix: bump enhanced-img version to avoid peer dep warning ([#12852](https://github.com/sveltejs/kit/pull/12852))

## 1.6.4
### Patch Changes


- fix: migrate `svelte` and `vite-plugin-svelte` to latest ([#12838](https://github.com/sveltejs/kit/pull/12838))

## 1.6.3
### Patch Changes


- chore: add `svelte-eslint-parser` to list of migratable dependencies ([#12828](https://github.com/sveltejs/kit/pull/12828))

## 1.6.2
### Patch Changes


- chore: upgrade to ts-morph 24 ([#12781](https://github.com/sveltejs/kit/pull/12781))

## 1.6.1
### Patch Changes


- chore: upgrade to ts-morph 23 ([#12607](https://github.com/sveltejs/kit/pull/12607))

## 1.6.0
### Minor Changes


- feat: pass filename to `migrate` to allow for `svelte:self` migration ([#12749](https://github.com/sveltejs/kit/pull/12749))


### Patch Changes


- fix: prompt SvelteKit 2 migration during Svelte 5 migration if necessary ([#12748](https://github.com/sveltejs/kit/pull/12748))

## 1.5.1
### Patch Changes


- fix: use `next` versions for `svelte` and `vite-plugin-svelte` ([#12729](https://github.com/sveltejs/kit/pull/12729))

## 1.5.0
### Minor Changes


- feat: add Svelte 5 migration ([#12519](https://github.com/sveltejs/kit/pull/12519))

## 1.4.5
### Patch Changes


- chore: configure provenance in a simpler manner ([#12570](https://github.com/sveltejs/kit/pull/12570))

## 1.4.4
### Patch Changes


- chore: package provenance ([#12567](https://github.com/sveltejs/kit/pull/12567))

## 1.4.3

### Patch Changes

- chore: add keywords for discovery in npm search ([#12330](https://github.com/sveltejs/kit/pull/12330))

## 1.4.2

### Patch Changes

- fix: bump import-meta-resolve to remove deprecation warnings ([#12240](https://github.com/sveltejs/kit/pull/12240))

## 1.4.1

### Patch Changes

- fix: continue traversing the children of non-self-closing elements ([#12175](https://github.com/sveltejs/kit/pull/12175))

## 1.4.0

### Minor Changes

- feat: add self-closing-tags migration ([#12128](https://github.com/sveltejs/kit/pull/12128))

## 1.3.8

### Patch Changes

- chore(deps): update dependency ts-morph to v22 ([`4447269e979f2b5be18e0fded0b5843a6258542d`](https://github.com/sveltejs/kit/commit/4447269e979f2b5be18e0fded0b5843a6258542d))

## 1.3.7

### Patch Changes

- fix: don't downgrade versions when bumping dependencies ([#11716](https://github.com/sveltejs/kit/pull/11716))

## 1.3.6

### Patch Changes

- fix: correct link to docs ([#11407](https://github.com/sveltejs/kit/pull/11407))

## 1.3.5

### Patch Changes

- chore: update primary branch from master to main ([`47779436c5f6c4d50011d0ef8b2709a07c0fec5d`](https://github.com/sveltejs/kit/commit/47779436c5f6c4d50011d0ef8b2709a07c0fec5d))

## 1.3.4

### Patch Changes

- suggest running migrate command with latest if migration does not exist ([#11362](https://github.com/sveltejs/kit/pull/11362))

## 1.3.3

### Patch Changes

- chore: insert package at sorted position ([#11332](https://github.com/sveltejs/kit/pull/11332))

- fix: adjust cookie migration logic, note installation ([#11331](https://github.com/sveltejs/kit/pull/11331))

## 1.3.2

### Patch Changes

- fix: handle jsconfig.json ([#11325](https://github.com/sveltejs/kit/pull/11325))

## 1.3.1

### Patch Changes

- chore: fix broken migration links ([#11320](https://github.com/sveltejs/kit/pull/11320))

## 1.3.0

### Minor Changes

- feat: add sveltekit v2 migration ([#11294](https://github.com/sveltejs/kit/pull/11294))

## 1.2.8

### Patch Changes

- chore(deps): update dependency ts-morph to v21 ([#11181](https://github.com/sveltejs/kit/pull/11181))

## 1.2.7

### Patch Changes

- chore(deps): update dependency ts-morph to v20 ([#10766](https://github.com/sveltejs/kit/pull/10766))

## 1.2.6

### Patch Changes

- fix: do not downgrade versions ([#10352](https://github.com/sveltejs/kit/pull/10352))

## 1.2.5

### Patch Changes

- fix: note old eslint plugin deprecation ([#10319](https://github.com/sveltejs/kit/pull/10319))

## 1.2.4

### Patch Changes

- fix: ensure glob finds all files in folders ([#10230](https://github.com/sveltejs/kit/pull/10230))

## 1.2.3

### Patch Changes

- fix: handle missing fields in migrate script ([#10221](https://github.com/sveltejs/kit/pull/10221))

## 1.2.2

### Patch Changes

- fix: finalize svelte-4 migration ([#10195](https://github.com/sveltejs/kit/pull/10195))

- fix: changed `index` to `index.d.ts` in `typesVersions` ([#10180](https://github.com/sveltejs/kit/pull/10180))

## 1.2.1

### Patch Changes

- docs: update readme ([#10066](https://github.com/sveltejs/kit/pull/10066))

## 1.2.0

### Minor Changes

- feat: add Svelte 4 migration ([#9729](https://github.com/sveltejs/kit/pull/9729))

## 1.1.3

### Patch Changes

- fix: include index in typesVersions because it's always matched ([#9147](https://github.com/sveltejs/kit/pull/9147))

## 1.1.2

### Patch Changes

- fix: update existing exports with prepended outdir ([#9133](https://github.com/sveltejs/kit/pull/9133))

- fix: use typesVersions to wire up deep imports ([#9133](https://github.com/sveltejs/kit/pull/9133))

## 1.1.1

### Patch Changes

- fix: include utils in migrate's published files ([#9085](https://github.com/sveltejs/kit/pull/9085))

## 1.1.0

### Minor Changes

- feat: add `@sveltejs/package` migration (v1->v2) ([#8922](https://github.com/sveltejs/kit/pull/8922))

## 1.0.1

### Patch Changes

- fix: correctly check for old load props ([#8537](https://github.com/sveltejs/kit/pull/8537))

## 1.0.0

### Major Changes

First major release, see below for the history of changes that lead up to this.
Starting from now all releases follow semver and changes will be listed as Major/Minor/Patch

## 1.0.0-next.13

### Patch Changes

- fix: more robust uppercase migration ([#7033](https://github.com/sveltejs/kit/pull/7033))

## 1.0.0-next.12

### Patch Changes

- feat: do uppercase http verbs migration on the fly ([#6371](https://github.com/sveltejs/kit/pull/6371))

## 1.0.0-next.11

### Patch Changes

- fix: git mv files correctly when they contain \$ characters ([#6129](https://github.com/sveltejs/kit/pull/6129))

## 1.0.0-next.10

### Patch Changes

- Revert change to suggest props destructuring ([#6099](https://github.com/sveltejs/kit/pull/6099))

## 1.0.0-next.9

### Patch Changes

- Handle Error without message, handle status 200, handle missing body ([#6096](https://github.com/sveltejs/kit/pull/6096))

## 1.0.0-next.8

### Patch Changes

- Suggest props destructuring if possible ([#6069](https://github.com/sveltejs/kit/pull/6069))
- Fix typo in migration task ([#6070](https://github.com/sveltejs/kit/pull/6070))

## 1.0.0-next.7

### Patch Changes

- Migrate type comments on arrow functions ([#5933](https://github.com/sveltejs/kit/pull/5933))
- Use LayoutLoad inside +layout.js files ([#5931](https://github.com/sveltejs/kit/pull/5931))

## 1.0.0-next.6

### Patch Changes

- Create `.ts` files from `<script context="module" lang="ts">` ([#5905](https://github.com/sveltejs/kit/pull/5905))

## 1.0.0-next.5

### Patch Changes

- Rewrite type names ([#5778](https://github.com/sveltejs/kit/pull/5778))

## 1.0.0-next.4

### Patch Changes

- handle lone return statements ([#5831](https://github.com/sveltejs/kit/pull/5831))
- Fix error placement on (arrow) function when checking load input ([#5840](https://github.com/sveltejs/kit/pull/5840))

## 1.0.0-next.3

### Patch Changes

- handle more import cases ([#5828](https://github.com/sveltejs/kit/pull/5828))
- check load function input ([#5838](https://github.com/sveltejs/kit/pull/5838))

## 1.0.0-next.2

### Patch Changes

- Correctly rename files with spaces when migrating ([#5820](https://github.com/sveltejs/kit/pull/5820))

## 1.0.0-next.1

### Patch Changes

- Add a README ([#5817](https://github.com/sveltejs/kit/pull/5817))
