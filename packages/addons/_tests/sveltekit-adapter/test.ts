import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import sveltekitAdapter from '../../sveltekit-adapter/index.ts';

const addonId = sveltekitAdapter.id;
const { test, variants, prepareServer } = setupTest({ [addonId]: sveltekitAdapter });

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { [addonId]: { adapter: 'node' } });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
