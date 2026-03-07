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
		failOnWarn: 'ci-only',
		deps: {
			// These are root-level devDependencies used only by testing.ts.
			// Without this, the DTS plugin inlines their entire type trees
			// (vitest pulls in postcss, vite, chai, etc.) bloating testing.d.mts.
			neverBundle: [/^vitest/, /^@vitest\//, /^@playwright\//, /^vite$/, /^postcss$/]
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
		},
		// postcss's own .d.ts files have MISSING_EXPORT warnings that rolldown
		// flags (upstream issue). Cannot use failOnWarn: true here until fixed.
		failOnWarn: false
	}
]);

export async function buildCliTemplates() {
	const start = performance.now();
	await buildTemplates(path.resolve('packages/sv/dist'));
	await buildTemplates(path.resolve('packages/sv/src/create/dist'));
	const [green, reset] = ['\x1b[32m', '\x1b[0m'];
	console.log(`${green}✔${reset} Templates built in ${Math.round(performance.now() - start)}ms`);
}
