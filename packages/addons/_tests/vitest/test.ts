import { execSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon/index.ts';
import path from 'node:path';
import fs from 'node:fs';

const { test, variants, prepareServer } = setupTest({ vitest });

test.concurrent.for(variants)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { vitest: {} });

	const { close } = await prepareServer({ cwd, page });

	execSync('pnpm exec playwright install chromium', { cwd, stdio: 'pipe' });
	execSync('pnpm test', { cwd, stdio: 'pipe' });

	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	const ext = variant.includes('ts') ? 'ts' : 'js';
	const viteFile = path.resolve(cwd, `vite.config.${ext}`);
	const viteContent = fs.readFileSync(viteFile, 'utf8');

	expect(viteContent).toContain(`vitest/config`);
});
