# Plan: Migrate to JSDoc + Remove tsdown (Merged)

## Overview

Combined plan: Convert `@sveltejs/cli` from TypeScript to JSDoc-based JavaScript **and** remove tsdown bundling to ship source files directly. Use `git mv` for all renames to preserve git history.

---

## Part A: TypeScript → JSDoc Migration (Do First)

**Key: Use `git mv` for all file renames to preserve history**

### A1: Type Foundation - Create .d.ts files

Files that MUST remain `.d.ts` (complex types):

| File | Reason |
|------|--------|
| `lib/core/addon/types.d.ts` (new) | `OptionValues<Args>`, `OptionBuilder<T>`, `Prettify<T>` |
| `lib/core/tooling/js/ts-estree.d.ts` | Module augmentation |

```bash
git mv lib/core/tooling/js/ts-estree.ts lib/core/tooling/js/ts-estree.d.ts
```

### A2: Migration Phases (all use git mv)

For each `.ts` file:
```bash
git mv lib/path/file.ts lib/path/file.js
# Then convert content to JSDoc
```

**Phase order (66 source files):**

1. **Core Utilities (12 files)**: `common`, `utils`, `sanitize`, `downloadJson`, parsers, tooling
2. **JS Tooling (7 files)**: imports, exports, function, vite, kit, index
3. **Addon System (5 files)**: workspace, processors, config, addons/common, addons/add
4. **CLI Utilities (10 files)**: env, errors, package-manager, add/*, create/utils
5. **CLI Commands (5 files)**: create, check, migrate
6. **Addon Implementations (14 files)**: all `lib/addons/*/index.ts`
7. **Entry Points (5 files)**: core.ts, index.ts, coreInternal.ts, testing.ts, bin.ts
8. **Tests (143 files)**: all test files

### A3: JSDoc Conversion Patterns

**Type imports:**
```javascript
/** @import { Addon, Question } from './types.d.ts' */
```

**Generic functions:**
```javascript
/**
 * @template {import('./types.d.ts').OptionDefinition} Args
 * @param {import('./types.d.ts').Addon<Args>} config
 * @returns {import('./types.d.ts').Addon<Args>}
 */
export function defineAddon(config) {
    return config;
}
```

### A4: Update tsconfig.json
```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": [
    "packages/sv/lib/**/*.js",
    "packages/sv/lib/**/*.d.ts",
    "packages/sv/bin.js"
  ]
}
```

### A5: Update tsdown.config.ts entry points
```javascript
entry: ['lib/index.js', 'lib/testing.js', 'lib/core.js', 'bin.js']
```

---

## Part B: Remove tsdown (Do After Migration)

### B1: Delete tsdown.config.ts
```bash
git rm tsdown.config.ts
```

### B2: Update packages/sv/package.json

```json
{
  "exports": {
    ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" },
    "./testing": { "types": "./lib/testing.d.ts", "default": "./lib/testing.js" },
    "./core": { "types": "./lib/core.d.ts", "default": "./lib/core.js" }
  },
  "bin": "./bin.js",
  "files": ["bin.js", "lib/**", "!lib/**/*.spec.js", "!lib/create/templates/**", "!lib/create/shared/**", "!lib/create/scripts/**"],
  "scripts": {
    "build": "node lib/create/scripts/build-templates.js lib/create/dist"
  }
}
```

Move runtime deps from `devDependencies` → `dependencies`:
- `@clack/prompts`, `commander`, `dedent`, `degit`, `empathic`, `esrap`
- `gitignore-parser`, `magic-string`, `package-manager-detector`, `picocolors`
- `ps-tree`, `silver-fleece`, `smol-toml`, `svelte`, `tar-fs`, `tiny-glob`
- `tinyexec`, `valibot`, `yaml`, `zimmerframe`

### B3: Simplify dist() in lib/create/utils.js
```js
export function dist(path) {
  return fileURLToPath(new URL(`./dist/${path}`, import.meta.url).href);
}
```

### B4: Update root package.json build script
```json
"build": "pnpm --filter sv build"
```

### B5: Delete packages/sv/dist/ folder
```bash
rm -rf packages/sv/dist/
```

---

## Files to Modify

| File | Action |
|------|--------|
| `tsdown.config.ts` | `git rm` |
| `packages/sv/dist/` | Delete folder |
| `packages/sv/package.json` | Update exports, bin, files, deps |
| `packages/sv/lib/create/utils.js` | Simplify `dist()` |
| `package.json` (root) | Update build script |
| `tsconfig.json` | Add allowJs, update includes |
| `lib/**/*.ts` (66 files) | `git mv` → `.js` + JSDoc convert |
| `lib/**/*.spec.ts` (143 files) | `git mv` → `.spec.js` + JSDoc convert |

---

## Verification

After each phase:
1. `pnpm check` - Type checking passes
2. `pnpm build` - Build succeeds
3. `pnpm test` - Tests pass
4. `git log --follow lib/path/file.js` - History preserved

Final verification:
1. `node packages/sv/bin.js create test-app`
2. `cd packages/sv && npm pack --dry-run` - Verify correct files
3. Test imports: `import { create } from 'sv'`
4. Verify IntelliSense in VS Code
