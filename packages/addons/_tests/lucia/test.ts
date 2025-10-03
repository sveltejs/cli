import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import lucia from '../../lucia/index.ts';
import drizzle from '../../drizzle/index.ts';
import path from 'node:path';
import fs from 'node:fs';

const { test, addonTestCases, prepareServer } = setupTest(
	{ drizzle, lucia },
	{
		kinds: [
			{
				type: 'default',
				options: { drizzle: { database: 'sqlite', sqlite: 'libsql' }, lucia: { demo: true } }
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit')
	}
);

test.concurrent.for(addonTestCases)('lucia $variant', async (addonTestCase, { page, ...ctx }) => {
	const cwd = ctx.run(addonTestCase);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	const ext = addonTestCase.variant.includes('ts') ? 'ts' : 'js';
	const filePath = path.resolve(cwd, `src/routes/demo/lucia/+page.server.${ext}`);
	const fileContent = fs.readFileSync(filePath, 'utf8');
	expect(fileContent).toContain(`export const actions`);
});
