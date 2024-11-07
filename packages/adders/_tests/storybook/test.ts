import { expect } from '@playwright/test';
import { setupTest } from '../_setup/setup.ts';
import storybook from '../../storybook/index.ts';

const { test, variants, prepareServer } = setupTest({ storybook });

let port = 6006;
test.concurrent.for(variants)('storybook loaded - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { storybook: {} });

	const p = port++;
	const { close } = await prepareServer({
		cwd,
		page,
		previewCommand: `pnpm storybook -p ${p} --ci`,
		buildCommand: 'echo'
	});
	// kill server process when we're done
	ctx.onTestFinished(() => close());

	await page.goto(`http://localhost:${p}`);

	expect(await page.$('main .sb-bar')).toBeTruthy();
	expect(await page.$('#storybook-preview-wrapper')).toBeTruthy();
});
