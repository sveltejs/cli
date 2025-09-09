import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import lucia from '../../lucia/index.ts';
import drizzle from '../../drizzle/index.ts';

const { test, variants, prepareServer } = setupTest(
	{ drizzle, lucia },
	{
		skipBrowser: true,
		runPrepareAndInstallWithOption: {
			default: { drizzle: { database: 'sqlite', sqlite: 'libsql' }, lucia: { demo: true } }
		}
	}
);

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = ctx.cwdVariant('default', variant);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
