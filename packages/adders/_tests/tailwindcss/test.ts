import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import { addFixture } from './fixtures.ts';
import tailwindcss from '../../tailwindcss/index.ts';

const { test, variants, prepareServer } = setupTest({ tailwindcss });

test.concurrent.for(variants)('none - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { tailwindcss: { plugins: [] } });

	// ...add test files
	addFixture(cwd, variant);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	const el = page.getByTestId('base');
	await expect(el).toHaveCSS('background-color', 'rgb(71, 85, 105)');
	await expect(el).toHaveCSS('border-color', 'rgb(249, 250, 251)');
	await expect(el).toHaveCSS('border-width', '4px');
	await expect(el).toHaveCSS('margin-top', '4px');
});

test.concurrent.for(variants)('typography - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { tailwindcss: { plugins: ['typography'] } });

	// ...add files
	addFixture(cwd, variant);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	const el = page.getByTestId('typography');
	await expect(el).toHaveCSS('font-size', '18px');
	await expect(el).toHaveCSS('line-height', '28px');
	await expect(el).toHaveCSS('text-align', 'right');
	await expect(el).toHaveCSS('text-decoration-line', 'line-through');
});
