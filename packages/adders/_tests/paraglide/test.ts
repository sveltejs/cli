import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import paraglide from '../../paraglide/index.ts';

const { test, variants, prepareServer } = setupTest({ paraglide });

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { paraglide: { demo: true, availableLanguageTags: 'en' } });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
