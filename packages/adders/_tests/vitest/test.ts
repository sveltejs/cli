import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon/index.ts';

const { test, variants, prepareServer } = setupTest({ vitest });

test.concurrent.for(variants)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { vitest: {} });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
