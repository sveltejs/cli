import path from 'node:path';
import { expect } from '@playwright/test';
import { fixture, setupTest } from './setup/suite.js';
import addon from '../src/index.js';

const id = addon.id;
const { test, addonTestCases, prepareServer } = setupTest(
	{ [id]: addon },
	{ kinds: [{ type: 'default', options: { [id]: { demo: true } } }] }
);

test.concurrent.for(addonTestCases)(
	'community-addon $variant',
	async (addonTestCase, { page, ...ctx }) => {
		const cwd = ctx.run(addonTestCase);

		// ...add files
		if (addonTestCase.variant.startsWith('kit')) {
			const target = path.resolve(cwd, 'src', 'routes', '+page.svelte');
			fixture({ name: '+page.svelte', target });
		} else {
			const target = path.resolve(cwd, 'src', 'App.svelte');
			fixture({ name: 'App.svelte', target });
		}

		const { close } = await prepareServer({ cwd, page });
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		// expectations
		const textContent = await page.getByTestId('demo').textContent();
		expect(textContent).toContain('This is a text file made by the Community Addon Template demo!');
	}
);
