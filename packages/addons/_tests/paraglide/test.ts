import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import paraglide from '../../paraglide/index.ts';

const { test, variants, prepareServer } = setupTest(
	{ paraglide },
	{
		skipBrowser: true,
		runPrepareAndInstallWithOption: {
			default: {
				options: { paraglide: { demo: true, languageTags: 'en' } },
				include: (v) => v.includes('kit')
			}
		}
	}
);

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = ctx.cwdVariant('default', variant);
	// const cwd = await ctx.run(variant, { paraglide: { demo: true, languageTags: 'en' } });

	const { close } = await prepareServer({ cwd, page, installCommand: null! });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
