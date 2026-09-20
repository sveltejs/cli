import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'tsdown';
import { buildTemplates } from './packages/sv/src/create/scripts/build-templates.js';

/**
 * Throwaway output dir for the single-entry DTS builds that feed
 * `scripts/generate-api-surface.js`. Gitignored; never published.
 */
const API_SURFACE_DIR = 'dts-api-surface';

/** Shared `deps` settings for every `sv` build (runtime + DTS-only api-surface). */
const svDeps = {
	// These are root-level devDependencies used only by testing.ts.
	// Without this, the DTS plugin inlines their entire type trees
	// (vitest pulls in postcss, vite, chai, etc.) bloating testing.d.mts.
	neverBundle: [/^vitest/, /^@vitest\//, /^@playwright\//, /^vite$/, /^postcss$/],
	onlyBundle: [
		'@clack/core',
		'@clack/prompts',
		'commander',
		'duplexer',
		'empathic',
		'event-stream',
		'fast-string-truncated-width',
		'fast-string-width',
		'fast-wrap-ansi',
		'from',
		'map-stream',
		'modern-tar',
		'pause-stream',
		'ps-tree',
		'sisteransi',
		'split',
		'stream-combiner',
		'through',
		'tinyexec',
		'valibot'
	]
};

/**
 * `rolldown-plugin-dts` warns once per process that the TypeScript 7 API is experimental.
 * `failOnWarn: true` would turn that notice into a build failure.
 */
const TSGO_EXPERIMENTAL_NOTICE = /TypeScript 7\.0 does not yet have a stable API/;

/** Shared `deps` settings for the sv-utils DTS-only builds. */
const svUtilsDtsDeps = {
	neverBundle: [/^svelte/, '@types/estree', 'estree', 'yaml', 'package-manager-detector'],
	onlyBundle: ['smol-toml', 'zimmerframe', 'dedent']
};

export default defineConfig([
	{
		cwd: path.resolve('packages/sv'),
		entry: ['src/index.ts', 'src/testing.ts', 'bin.ts'],
		sourcemap: !process.env.CI,
		dts: {
			generator: 'tsgo'
		},
		failOnWarn: true,
		suppressWarnings: TSGO_EXPERIMENTAL_NOTICE,
		deps: svDeps,
		plugins: [],
		inputOptions: {
			experimental: {
				resolveNewUrlToAsset: false
			},
			// rolldown-plugin-dts:fake-js transforms the dts entry without emitting a
			// sourcemap, which rolldown >=1.1 flags as SOURCEMAP_BROKEN. The warning is
			// spurious (it only concerns the generated .d.mts), so ignore just that code;
			// failOnWarn: true still applies to every other warning.
			onLog(level, log, defaultHandler) {
				if (log.code === 'SOURCEMAP_BROKEN') return;
				defaultHandler(level, log);
			}
		},
		hooks: {
			async 'build:before'() {
				await buildCliTemplates();
			}
		}
	},
	// sv: DTS-only single-entry builds for the api-surface snapshots.
	// The runtime build above code-splits shared declarations into an `engine-*.d.mts`
	// chunk, so its entry `.d.mts` files only re-export names without signatures.
	// Building each public entry on its own emits a self-contained `.d.ts` with every
	// referenced declaration inlined (no shared chunk), which `generate-api-surface.js`
	// reads instead. Output goes to a throwaway, gitignored dir.
	{
		cwd: path.resolve('packages/sv'),
		entry: ['src/index.ts'],
		outDir: `${API_SURFACE_DIR}/index`,
		dts: {
			generator: 'tsgo',
			emitDtsOnly: true
		},
		failOnWarn: true,
		suppressWarnings: TSGO_EXPERIMENTAL_NOTICE,
		deps: svDeps,
		inputOptions: {
			experimental: {
				resolveNewUrlToAsset: false
			}
		}
	},
	{
		cwd: path.resolve('packages/sv'),
		entry: ['src/testing.ts'],
		outDir: `${API_SURFACE_DIR}/testing`,
		dts: {
			generator: 'tsgo',
			emitDtsOnly: true
		},
		failOnWarn: true,
		suppressWarnings: TSGO_EXPERIMENTAL_NOTICE,
		deps: svDeps,
		inputOptions: {
			experimental: {
				resolveNewUrlToAsset: false
			}
		}
	},
	// sv-utils: runtime build (bundles everything including svelte)
	{
		cwd: path.resolve('packages/sv-utils'),
		entry: ['src/index.ts', 'src/browser.ts'],
		sourcemap: !process.env.CI,
		exports: {
			devExports: true,
			inlinedDependencies: false,
			packageJson: false,
			// `*.d.mts` comes from the DTS-only sv-utils builds below, not from this one.
			customExports: (exports, { isPublish }) => {
				exports['.'] = isPublish
					? { types: './dist/index.d.mts', default: './dist/index.mjs' }
					: './src/index.ts';
				exports['./browser'] = isPublish
					? { types: './dist/browser.d.mts', default: './dist/browser.mjs' }
					: './src/browser.ts';
				return exports;
			}
		},
		dts: false,
		failOnWarn: true,
		// `yaml` ships a CJS node build (reached through `createRequire`) and an ESM browser
		// build. Resolving its `browser` field keeps the shared chunk free of node builtins;
		// the node entry works fine with it too.
		inputOptions: {
			resolve: {
				aliasFields: [['browser']]
			}
		},
		deps: {
			onlyBundle: [
				'@jridgewell/gen-mapping',
				'@jridgewell/remapping',
				'@jridgewell/sourcemap-codec',
				'@jridgewell/trace-mapping',
				'@sveltejs/acorn-typescript',
				'acorn',
				'aria-query',
				'axobject-query',
				'decircular',
				'dedent',
				'diff',
				'esrap',
				'locate-character',
				'package-manager-detector',
				'silver-fleece',
				'smol-toml',
				'svelte',
				'verkit',
				'yaml',
				'zimmerframe'
			]
		}
	},
	// sv-utils: DTS-only build (svelte externalized)
	// Svelte uses `declare module 'svelte/compiler'` which rolldown-plugin-dts
	// v0.21+ cannot inline. This is a known issue: https://github.com/sveltejs/svelte/issues/17520
	// Once svelte ships separate .d.ts files per entry point, this split can be removed.
	// One build per entry so each emitted `.d.mts` stays self-contained
	// (a shared chunk would leave `api-surface.md` with bare re-exports).
	{
		cwd: path.resolve('packages/sv-utils'),
		entry: ['src/index.ts'],
		dts: {
			generator: 'oxc',
			emitDtsOnly: true
		},
		failOnWarn: true,
		deps: svUtilsDtsDeps
	},
	{
		cwd: path.resolve('packages/sv-utils'),
		entry: ['src/browser.ts'],
		dts: {
			generator: 'oxc',
			emitDtsOnly: true
		},
		failOnWarn: true,
		deps: svUtilsDtsDeps
	}
]);

export async function buildCliTemplates() {
	const start = performance.now();
	await buildTemplates(path.resolve('packages/sv/dist'));
	await buildTemplates(path.resolve('packages/sv/src/create/dist'));
	const [green, reset] = ['\x1b[32m', '\x1b[0m'];
	console.log(`${green}✔${reset} Templates built in ${Math.round(performance.now() - start)}ms`);
}
