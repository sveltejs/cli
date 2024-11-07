import { expect } from '@playwright/test';
import { setupTest } from '../_setup/setup.ts';
import prettier from '../../prettier/index.ts';

const { test, variants, prepareServer } = setupTest({ prettier });

test.concurrent.for(variants)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { prettier: {} });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(() => close());

	expect(true).toBe(true);
});
