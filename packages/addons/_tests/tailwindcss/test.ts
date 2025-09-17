import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import { addFixture } from './fixtures.ts';
import tailwindcss from '../../tailwindcss/index.ts';

const { test, prepareServer, flavors } = setupTest(
	{ tailwindcss },
	{
		kinds: [
			{ type: 'none', options: { tailwindcss: { plugins: [] } } },
			{ type: 'typography', options: { tailwindcss: { plugins: ['typography'] } } }
		]
	}
);

test.concurrent.for(flavors)(
	'tailwindcss $kind.type $variant ',
	async (flavor, { page, ...ctx }) => {
		const cwd = ctx.run(flavor);

		// ...add test files
		addFixture(cwd, flavor.variant);

		const { close } = await prepareServer({ cwd, page });
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		if (flavor.kind.type === 'none') {
			const el = page.getByTestId('base');
			await expect(el).toHaveCSS('background-color', 'oklch(0.446 0.043 257.281)');
			await expect(el).toHaveCSS('border-color', 'oklch(0.985 0.002 247.839)');
			await expect(el).toHaveCSS('border-width', '4px');
			await expect(el).toHaveCSS('margin-top', '4px');
		} else if (flavor.kind.type === 'typography') {
			const el = page.getByTestId('typography');
			await expect(el).toHaveCSS('font-size', '18px');
			await expect(el).toHaveCSS('line-height', '28px');
			await expect(el).toHaveCSS('text-align', 'right');
			await expect(el).toHaveCSS('text-decoration-line', 'line-through');
		}
	}
);
