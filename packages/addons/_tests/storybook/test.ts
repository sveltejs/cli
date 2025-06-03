import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import storybook from '../../storybook/index.ts';
import eslint from '../../eslint/index.ts';

// we're including the `eslint` add-on to prevent `storybook` from modifying this repo's `eslint.config.js`
const { test, variants, prepareServer } = setupTest({ storybook, eslint });

let port = 6006;

test.for(variants)(
	'storybook loaded - %s',
	{ concurrent: !process.env.CI },
	async (variant, { page, ...ctx }) => {
		const cwd = await ctx.run(variant, { storybook: {}, eslint: {} });

		const { close } = await prepareServer({
			cwd,
			page,
			previewCommand: `pnpm storybook -p ${++port} --ci`,
			buildCommand: ''
		});
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		expect(await page.$('main .sb-bar')).toBeTruthy();
		expect(await page.$('#storybook-preview-wrapper')).toBeTruthy();
	}
);
