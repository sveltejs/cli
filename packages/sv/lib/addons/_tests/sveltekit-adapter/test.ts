import { join } from 'node:path';
import { readFileSync } from 'node:fs/promises';
import { expect } from '@playwright/test';
import sveltekitAdapter from '../../sveltekit-adapter/index.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = sveltekitAdapter.id;
const { test, testCases } = setupTest(
	{ [addonId]: sveltekitAdapter },
	{
		kinds: [
			{ type: 'node', options: { [addonId]: { adapter: 'node' } } },
			{ type: 'auto', options: { [addonId]: { adapter: 'auto' } } }
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
	}
});
