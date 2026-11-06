// Everything that runs anywhere (parsers, transforms, pure helpers) lives in
// `browser.ts` and is also published as `@sveltejs/sv-utils/browser`.
export * from './browser.ts';

// Package managers (delegates to `package-manager-detector`; see `pm.ts`)
export {
	AGENTS,
	type AgentName,
	COMMANDS,
	constructCommand,
	detect,
	resolveCommand,
	resolveCommandArray
} from './pm.ts';

// Package manager helpers
export * as pnpm from './pnpm.ts';

// Shell helpers
export { commandExists } from './command.ts';

// File system helpers (sync, workspace-relative paths)
export { fileExists, loadFile, loadPackageJson, saveFile, type Package } from './files.ts';

// Svelte/kit config (abstracts over `svelte.config.{js,ts}` vs `sveltekit()` in `vite.config.{js,ts}`)
export {
	svelteConfig,
	type ConfigFileReader,
	type SvelteConfigKind,
	type SvelteConfigLocation,
	type SvelteConfigObjects
} from './svelte-config.ts';

// Floating add-on demo links, upserted into the root layout
export { defineDemoPage, type DemoPage } from './demo-page.ts';

// Env access (abstracts over legacy `$env/dynamic/*` vs declared `$app/env/*` + `src/env.ts`)
export { defineEnv } from './env.ts';

// Kit 3 specifics (version detection, `$lib` -> `#lib`, the generated tsconfig)
export {
	KIT3_TSCONFIG,
	KIT3_TSCONFIG_DEFAULT,
	isKit3,
	resolveHooksTypesFrom,
	libSubpathImports,
	resolveLibPrefix
} from './kit3.ts';

// Terminal styling
export { color } from './color.ts';
