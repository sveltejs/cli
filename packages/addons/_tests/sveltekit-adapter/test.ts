import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import sveltekitAdapter from '../../sveltekit-adapter/index.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = sveltekitAdapter.id;
const { test, variants, prepareServer } = setupTest({ [addonId]: sveltekitAdapter });

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { [addonId]: { adapter: 'node' } });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch('adapter-auto');
});
