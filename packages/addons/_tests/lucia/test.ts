import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import lucia from '../../lucia/index.ts';
import drizzle from '../../drizzle/index.ts';

const { test, variants, prepareServer } = setupTest({ drizzle, lucia }, { skipBrowser: true });

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, {
		drizzle: { database: 'sqlite', sqlite: 'libsql' },
		lucia: { demo: true }
	});

	const { close } = await prepareServer({
		cwd,
		page,
		installCommand: variant.includes('ts') ? undefined : null!,
		buildCommand: variant.includes('ts') ? undefined : null!
	});
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
