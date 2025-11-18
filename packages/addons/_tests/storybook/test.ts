import process from 'node:process';
import { exec } from 'tinyexec';
import { expect } from '@playwright/test';
import { beforeAll } from 'vitest';
import { setupTest } from '../_setup/suite.ts';
import storybook, { STORYBOOK_VERSION } from '../../storybook/index.ts';
import eslint from '../../eslint/index.ts';

// we're including the `eslint` add-on to prevent `storybook` from modifying this repo's `eslint.config.js`
const { test, testCases, prepareServer } = setupTest(
	{ storybook, eslint },
	{ kinds: [{ type: 'default', options: { storybook: {}, eslint: {} } }] }
);

let port = 6006;
const CI = Boolean(process.env.CI);

beforeAll(async () => {
	if (CI) {
		// prefetch the storybook cli during ci to reduce fetching errors in tests
		await exec('pnpm', ['dlx', `create-storybook@${STORYBOOK_VERSION}`, '--version']);
	}
});

test.for(testCases)(
	'storybook $variant',
	{ concurrent: !CI },
	async (testCase, { page, ...ctx }) => {
		const cwd = ctx.cwd(testCase);

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
