import { buildTemplates } from './packages/sv/lib/create/scripts/build-templates.js';
import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'tsdown';

export default defineConfig({
	cwd: path.resolve('packages/sv'),
	entry: ['lib/index.ts', 'lib/testing.ts', 'lib/core.ts', 'bin.ts'],
	sourcemap: !process.env.CI,
	dts: { oxc: true },
	external: ['svelte/compiler', '@types/estree', 'estree'],
	inlineOnly: [
		'through',
		'from',
		'duplexer',
		'map-stream',
		'pause-stream',
		'split',
		'stream-combiner',
		'event-stream',
		'ps-tree',
		'empathic',
		'valibot',
		'magic-string',
		'events-universal',
		'fast-fifo',
		'b4a',
		'text-decoder',
		'streamx',
		'tar-stream',
		'wrappy',
		'once',
		'end-of-stream',
		'pump',
		'tar-fs',
		'@clack/core',
		'@clack/prompts',
		'dedent',
		'zimmerframe',
		'package-manager-detector',
		'yaml',
		'smol-toml',
		'commander',
		'picocolors',
		'sisteransi',
		'tinyexec',
		'decircular',
		'@jridgewell/sourcemap-codec',
		'esrap',
		'silver-fleece'
	],
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
});

export async function buildCliTemplates() {
	const start = performance.now();
	await buildTemplates(path.resolve('packages/sv/dist'));
	await buildTemplates(path.resolve('packages/sv/lib/create/dist'));
	const green = '\x1b[32m';
	const reset = '\x1b[0m';
	console.log(`${green}✔${reset} Templates built in ${Math.round(performance.now() - start)}ms`);
}
