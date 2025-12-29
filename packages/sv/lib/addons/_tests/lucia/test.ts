import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import lucia from '../../lucia/index.ts';
import drizzle from '../../drizzle/index.ts';
import path from 'node:path';
import fs from 'node:fs';

const { test, testCases, prepareServer } = setupTest(
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

test.concurrent.for(testCases)('lucia $variant', async (testCase, { page, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	const language = testCase.variant.includes('ts') ? 'ts' : 'js';
	const filePath = path.resolve(cwd, `src/routes/demo/lucia/+page.server.${language}`);
	const fileContent = fs.readFileSync(filePath, 'utf8');
	expect(fileContent).toContain(`export const actions`);
});
