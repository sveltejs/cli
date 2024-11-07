import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import eslint from '../../eslint/index.ts';

const { test, variants, prepareServer } = setupTest({ eslint });

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { eslint: {} });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(() => close());

	expect(true).toBe(true);
});
