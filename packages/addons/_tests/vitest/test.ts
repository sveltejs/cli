import { execSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon/index.ts';

const { test, variants, prepareServer } = setupTest(
	{ vitest },
	{ skipBrowser: true, runPrepareAndInstallWithOption: { default: { options: { vitest: {} } } } }
);

test.concurrent.for(variants)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = ctx.cwdVariant('default', variant);

	const { close } = await prepareServer({ cwd, page, installCommand: null! });

	execSync('pnpm exec playwright install chromium', { cwd, stdio: 'pipe' });
	execSync('pnpm test', { cwd, stdio: 'pipe' });

	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
