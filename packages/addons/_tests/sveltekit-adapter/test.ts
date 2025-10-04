import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import sveltekitAdapter from '../../sveltekit-adapter/index.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = sveltekitAdapter.id;
const { test, addonTestCases, prepareServer } = setupTest(
	{ [addonId]: sveltekitAdapter },
	{
		kinds: [
			{ type: 'node', options: { [addonId]: { adapter: 'node' } } },
			{ type: 'auto', options: { [addonId]: { adapter: 'auto' } } }
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit')
	}
);

test.concurrent.for(addonTestCases)(
	'adapter $kind.type $variant',
	async (addonTestCase, { page, ...ctx }) => {
		const cwd = ctx.run(addonTestCase);

		const { close } = await prepareServer({ cwd, page });
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		if (addonTestCase.kind.type === 'node') {
			expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch('adapter-auto');
			expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch(
				'adapter-auto only supports some environments'
			);
		} else if (addonTestCase.kind.type === 'auto') {
			expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('adapter-auto');
			expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch(
				'adapter-auto only supports some environments'
			);
		}
	}
);
