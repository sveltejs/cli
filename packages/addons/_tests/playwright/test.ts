import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import playwright from '../../playwright/index.ts';

const { test, variants, prepareServer } = setupTest(
	{ playwright },
	{ skipBrowser: true, runPrepareAndInstallWithOption: { default: { playwright: {} } } }
);

test.concurrent.for(variants)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = ctx.cwdVariant('default', variant);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
