import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import addon from '../src/index.js';
import { setupTest } from './setup/suite.js';

const id = addon.id;

// set to true to enable browser testing
const browser = false;

const { test, prepareServer, testCases } = setupTest(
	{ addon },
	{
		kinds: [{ type: 'default', options: { [id]: addon } }],
		filter: (testCase) => testCase.variant.includes('kit'),
		browser
	}
);

test.concurrent.for(testCases)(
	'@my-org/sv $kind.type $variant',
	async (testCase, { page, ...ctx }) => {
		const cwd = ctx.cwd(testCase);

		const msg =
			"This is a text file made by the Community Addon Template demo for the add-on: '@my-org/sv'!";

		const contentPath = path.resolve(cwd, `src/lib/@my-org/sv/content.txt`);
		const contentContent = fs.readFileSync(contentPath, 'utf8');

		// Check if we have the imports
		expect(contentContent).toContain(msg);

		// For browser testing
		if (browser) {
			const { close } = await prepareServer({ cwd, page });
			// kill server process when we're done
			ctx.onTestFinished(async () => await close());

			// expectations
			const textContent = await page.locator('p').last().textContent();
			if (testCase.variant.includes('kit')) {
				expect(textContent).toContain(msg);
			} else {
				// it's not a kit plugin!
				expect(textContent).not.toContain(msg);
			}
		}
	}
);
