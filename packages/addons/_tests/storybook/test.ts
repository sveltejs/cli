import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import storybook from '../../storybook/index.ts';

const { test, variants, prepareServer } = setupTest({ storybook });

let port = 6006;

const windowsCI = process.env.CI && process.platform === 'win32';
test.for(variants)(
	'storybook loaded - %s',
	{ concurrent: !windowsCI },
	async (variant, { page, ...ctx }) => {
		const cwd = await ctx.run(variant, { storybook: {} });

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
