import { buildTemplates } from './packages/sv/lib/create/scripts/build-templates.js';
import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'tsdown';

export default defineConfig([
	{
		cwd: path.resolve('packages/sv'),
		entry: ['lib/index.ts', 'lib/testing.ts', 'bin.ts'],
		sourcemap: !process.env.CI,
		dts: {
			oxc: true
		},
		plugins: [],
		noExternal: ['@sveltejs/sv-utils'],
		alias: {
			'@sveltejs/sv-utils': path.resolve('packages/sv-utils/src/index.ts')
		},
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
	{
		cwd: path.resolve('packages/sv-utils'),
		entry: ['src/index.ts'],
		sourcemap: !process.env.CI,
		dts: {
			oxc: true
		}
	}
]);

export async function buildCliTemplates() {
	const start = performance.now();
	await buildTemplates(path.resolve('packages/sv/dist'));
	await buildTemplates(path.resolve('packages/sv/lib/create/dist'));
	const green = '\x1b[32m';
	const reset = '\x1b[0m';
	console.log(`${green}✔${reset} Templates built in ${Math.round(performance.now() - start)}ms`);
}
