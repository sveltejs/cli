import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import sveltekitAdapter from '../../sveltekit-adapter/index.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = sveltekitAdapter.id;
const { test, flavors, prepareServer } = setupTest(
	{ [addonId]: sveltekitAdapter },
	{
		kinds: [
			{ type: 'node', options: { [addonId]: { adapter: 'node' } } },
			{ type: 'auto', options: { [addonId]: { adapter: 'auto' } } }
		],
		filter: (flavor) => flavor.variant.includes('kit')
	}
);

test.concurrent.for(flavors)('adapter $kind.type $variant', async (flavor, { page, ...ctx }) => {
	const cwd = ctx.run(flavor);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	if (flavor.kind.type === 'node') {
		expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch('adapter-auto');
		expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch(
			'adapter-auto only supports some environments'
		);
	} else if (flavor.kind.type === 'auto') {
		expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('adapter-auto');
		expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch(
			'adapter-auto only supports some environments'
		);
	}
});
