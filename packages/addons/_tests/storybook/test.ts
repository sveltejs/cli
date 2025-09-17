import process from 'node:process';
import { execSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { beforeAll } from 'vitest';
import { setupTest } from '../_setup/suite.ts';
import storybook from '../../storybook/index.ts';
import eslint from '../../eslint/index.ts';

// we're including the `eslint` add-on to prevent `storybook` from modifying this repo's `eslint.config.js`
const { test, flavors, prepareServer } = setupTest(
	{ storybook, eslint },
	{ kinds: [{ type: 'default', options: { storybook: {}, eslint: {} } }] }
);

let port = 6006;
const CI = Boolean(process.env.CI);

beforeAll(() => {
	if (CI) {
		// prefetch the storybook cli during ci to reduce fetching errors in tests
		execSync('pnpx create-storybook@latest --version');
	}
});

test.for(flavors)('storybook $variant', { concurrent: !CI }, async (flavor, { page, ...ctx }) => {
	const cwd = ctx.run(flavor);

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
});
