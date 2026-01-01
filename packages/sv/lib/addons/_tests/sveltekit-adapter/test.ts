import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import sveltekitAdapter from '../../sveltekit-adapter/index.js';
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

	if (testCase.kind.type === 'node') {
		expect(readFileSync(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch('adapter-auto');
		expect(readFileSync(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (testCase.kind.type === 'auto') {
		expect(readFileSync(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('adapter-auto');
		expect(readFileSync(join(cwd, 'svelte.config.js'), 'utf8')).toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (testCase.kind.type === 'cloudflare-workers') {
		expect(readFileSync(join(cwd, 'wrangler.jsonc'), 'utf8')).toMatch('ASSETS');
	} else if (testCase.kind.type === 'cloudflare-pages') {
		expect(readFileSync(join(cwd, 'wrangler.jsonc'), 'utf8')).toMatch('pages_build_output_dir');
	}
});
