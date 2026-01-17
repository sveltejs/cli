/** @import { Fixtures } from '../../../testing.js' */

import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.js';
import storybook from '../../storybook/index.js';
import eslint from '../../eslint/index.js';

// we're including the `eslint` add-on to prevent `storybook` from modifying this repo's `eslint.config.js`
const { test, testCases, prepareServer } = setupTest(
	{ storybook, eslint },
	{ kinds: [{ type: 'default', options: { storybook: {}, eslint: {} } }] }
);

let port = 6006;

test.concurrent.for(testCases)(
	'storybook $variant',
	async (testCase, /** @type {Fixtures & import('vitest').TestContext} */ ctx) => {
		const cwd = ctx.cwd(testCase);
		const page = ctx.page;

		const { close } = await prepareServer({
			cwd,
			page,
			previewCommand: `pnpm storybook -p ${++port} --ci`,
			buildCommand: ''
		});
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		expect(page.locator('main .sb-bar')).toBeTruthy();
		expect(page.locator('#storybook-preview-wrapper')).toBeTruthy();
	}
);
