import { expect } from '@playwright/test';
import { setupTest } from './setup/suite.js';
import addon from '../src/index.js';

const id = addon.id;
const { test, prepareServer, testCases } = setupTest(
	{ addon },
	{
		kinds: [{ type: 'default', options: { [id]: addon } }],
		filter: (testCase) => testCase.variant.includes('kit')
	}
);

test.concurrent.for(testCases)(
	'hello $kind.type $variant',
	async (testCase, { page, ...ctx }) => {
		const cwd = ctx.cwd(testCase);

		const { close } = await prepareServer({ cwd, page });
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		// expectations
		const textContent = await page.locator('p').last().textContent();
		const msg =
			"This is a text file made by the Community Addon Template demo for the add-on: 'hello'!";
		if (testCase.variant.includes('kit')) {
			expect(textContent).toContain(msg);
		} else {
			// it's not a kit plugin!
			expect(textContent).not.toContain(msg);
		}
	}
);
