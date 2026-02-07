import { buildTemplates } from './packages/sv/src/create/scripts/build-templates.js';
import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'tsdown';

export default defineConfig([
	{
		cwd: path.resolve('packages/sv'),
		entry: ['src/index.ts', 'src/testing.ts', 'bin.ts'],
		sourcemap: !process.env.CI,
		dts: {
			oxc: true
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
	await buildTemplates(path.resolve('packages/sv/src/create/dist'));
	const green = '\x1b[32m';
	const reset = '\x1b[0m';
	console.log(`${green}✔${reset} Templates built in ${Math.round(performance.now() - start)}ms`);
}
