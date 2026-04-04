import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'tsdown';
import { buildTemplates } from './packages/sv/src/create/scripts/build-templates.js';

export default defineConfig([
	{
		cwd: path.resolve('packages/sv'),
		entry: ['src/index.ts', 'src/testing.ts', 'bin.ts'],
		sourcemap: !process.env.CI,
		dts: {
			oxc: true
		},
		failOnWarn: true,
		deps: {
			// These are root-level devDependencies used only by testing.ts.
			// Without this, the DTS plugin inlines their entire type trees
			// (vitest pulls in postcss, vite, chai, etc.) bloating testing.d.mts.
			neverBundle: [/^vitest/, /^@vitest\//, /^@playwright\//, /^vite$/, /^postcss$/],
			onlyBundle: [
				'@clack/core',
				'@clack/prompts',
				'commander',
				'empathic',
				'event-stream',
				'events-universal',
				'from',
				'duplexer',
				'map-stream',
				'pause-stream',
				'split',
				'stream-combiner',
				'through',
				'b4a',
				'fast-fifo',
				'text-decoder',
				'streamx',
				'tar-stream',
				'tar-fs',
				'once',
				'wrappy',
				'end-of-stream',
				'pump',
				'picocolors',
				'sisteransi',
				'ps-tree',
				'tinyexec',
				'valibot'
			]
		},
		plugins: [],
		inputOptions: {
			experimental: {
				resolveNewUrlToAsset: false
			}
		},
		hooks: {
			async 'build:before'() {
				await buildCliTemplates();
			}
		}
	},
	// sv-utils: runtime build (bundles everything including svelte)
	{
		cwd: path.resolve('packages/sv-utils'),
		entry: ['src/index.ts'],
		sourcemap: !process.env.CI,
		dts: false,
		failOnWarn: true,
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
				'esrap',
				'locate-character',
				'package-manager-detector',
				'silver-fleece',
				'smol-toml',
				'svelte',
				'yaml',
				'zimmerframe'
			]
		}
	},
	// sv-utils: DTS-only build (svelte externalized)
	// Svelte uses `declare module 'svelte/compiler'` which rolldown-plugin-dts
	// v0.21+ cannot inline. This is a known issue: https://github.com/sveltejs/svelte/issues/17520
	// Once svelte ships separate .d.ts files per entry point, this split can be removed.
	{
		cwd: path.resolve('packages/sv-utils'),
		entry: ['src/index.ts'],
		dts: {
			oxc: true,
			emitDtsOnly: true
		},
		failOnWarn: true,
		deps: {
			neverBundle: [
				/^svelte/,
				'@types/estree',
				'estree',
				'yaml',
				'dedent',
				'package-manager-detector'
			],
			onlyBundle: ['smol-toml', 'zimmerframe']
		}
	}
]);

export async function buildCliTemplates() {
	const start = performance.now();
	await buildTemplates(path.resolve('packages/sv/dist'));
	await buildTemplates(path.resolve('packages/sv/src/create/dist'));
	const [green, reset] = ['\x1b[32m', '\x1b[0m'];
	console.log(`${green}✔${reset} Templates built in ${Math.round(performance.now() - start)}ms`);
}
