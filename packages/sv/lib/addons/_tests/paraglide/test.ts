import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import paraglide from '../../paraglide/index.js';
import fs from 'node:fs';
import path from 'node:path';

const langs = ['en', 'fr', 'hu'];

const { test, testCases, prepareServer } = setupTest(
	{ paraglide },
	{
		kinds: [
			{ type: 'default', options: { paraglide: { demo: true, languageTags: langs.join(',') } } }
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit')
	}
);

test.concurrent.for(testCases)('paraglide $variant', async (testCase, { page, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	for (const lang of langs) {
		const filePath = path.resolve(cwd, `src/lib/paraglide/messages/${lang}.js`);
		const fileContent = fs.readFileSync(filePath, 'utf8');
		expect(fileContent).toContain(`hello_world`);
	}
});
