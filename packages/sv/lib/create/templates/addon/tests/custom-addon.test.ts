import { expect } from '@playwright/test';
import { setupTest } from './setup/suite.js';
import addon from '../src/index.js';
import { addFixture } from './fixtures.ts';

const id = addon.id;
const { test, prepareServer, testCases } = setupTest(
	{ addon },
	{
		kinds: [{ type: 'default', options: { [id]: addon } }]
	}
);

test.concurrent.for(testCases)(
	'~SV-NAME-TODO~ $kind.type $variant',
	async (testCase, { page, ...ctx }) => {
		const cwd = ctx.cwd(testCase);

		// ...add test files
		addFixture(cwd, testCase.variant);

		const { close } = await prepareServer({ cwd, page });
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		// expectations
		const textContent = await page.getByTestId('demo').textContent();
		expect(textContent).toContain('This is a text file made by the Community Addon Template demo!');
	}
);
