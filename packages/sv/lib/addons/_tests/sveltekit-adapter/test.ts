import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import sveltekitAdapter from '../../sveltekit-adapter/index.ts';
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

test.concurrent.for(testCases)('adapter $kind.type $variant', async (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	if (testCase.kind.type === 'node') {
		expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch('adapter-auto');
		expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (testCase.kind.type === 'auto') {
		expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('adapter-auto');
		expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (testCase.kind.type === 'cloudflare-workers') {
		expect(await readFile(join(cwd, 'wrangler.jsonc'), 'utf8')).toMatch('ASSETS');
	} else if (testCase.kind.type === 'cloudflare-pages') {
		expect(await readFile(join(cwd, 'wrangler.jsonc'), 'utf8')).toMatch('pages_build_output_dir');
	}
});
