import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import pkg from '../../../../package.json' with { type: 'json' };
import sveltekitAdapter from '../../sveltekit-adapter.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = sveltekitAdapter.id;
const { test, testCases } = setupTest(
	{ [addonId]: sveltekitAdapter },
	{
		kinds: [
			{ type: 'node', options: { [addonId]: { adapter: 'node' } } },
			{ type: 'auto', options: { [addonId]: { adapter: 'auto' } } },
			{
				type: 'cloudflare-workers',
				options: { [addonId]: { adapter: 'cloudflare', cfTarget: 'workers' } }
			},
			{
				type: 'cloudflare-pages',
				options: { [addonId]: { adapter: 'cloudflare', cfTarget: 'pages' } }
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit'),
		browser: false
	}
);

test.concurrent.for(testCases)('adapter $kind.type $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);
	const packageJson = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
	const adapterPackage = Object.keys(packageJson.devDependencies).find((dependency) =>
		dependency.startsWith('@sveltejs/adapter-')
	);
	expect(adapterPackage).toBeDefined();
	if (pkg.version.includes('-next.')) {
		expect(packageJson.devDependencies[adapterPackage!]).toBe('next');
	} else {
		expect(packageJson.devDependencies[adapterPackage!]).not.toBe('next');
	}

	// config lives in vite.config.ts (ts) or vite.config.js (js)
	const viteConfig = ['vite.config.ts', 'vite.config.js']
		.map((name) => join(cwd, name))
		.find((file) => existsSync(file))!;

	if (testCase.kind.type === 'node') {
		expect(readFileSync(viteConfig, 'utf8')).not.toMatch('adapter-auto');
		expect(readFileSync(viteConfig, 'utf8')).not.toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (testCase.kind.type === 'auto') {
		expect(readFileSync(viteConfig, 'utf8')).toMatch('adapter-auto');
		expect(readFileSync(viteConfig, 'utf8')).toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (testCase.kind.type === 'cloudflare-workers') {
		expect(readFileSync(join(cwd, 'wrangler.jsonc'), 'utf8')).toMatch('ASSETS');
	} else if (testCase.kind.type === 'cloudflare-pages') {
		expect(readFileSync(join(cwd, 'wrangler.jsonc'), 'utf8')).toMatch('pages_build_output_dir');
	}
});
