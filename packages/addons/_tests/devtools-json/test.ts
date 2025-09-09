import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import devtoolsJson from '../../devtools-json/index.ts';
import fs from 'node:fs';
import path from 'node:path';

const { test, variants, prepareServer } = setupTest(
	{ devtoolsJson },
	{
		skipBrowser: true,
		runPrepareAndInstallWithOption: { devtoolsJson: {} }
	}
);

test.concurrent.for(variants)('default - %s', async (variant, { page, ...ctx }) => {
	const cwd = ctx.cwdVariant(variant);

	const { close } = await prepareServer({ cwd, page, installCommand: null! });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	const ext = variant.includes('ts') ? 'ts' : 'js';
	const viteFile = path.resolve(cwd, `vite.config.${ext}`);
	const viteContent = fs.readFileSync(viteFile, 'utf8');

	// Check if we have the import part
	expect(viteContent).toContain(`import devtoolsJson from`);
	expect(viteContent).toContain(`vite-plugin-devtools-json`);

	// Check if it's called
	expect(viteContent).toContain(`devtoolsJson()`);
});
