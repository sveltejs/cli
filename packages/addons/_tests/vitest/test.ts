import { execAsync, setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon/index.ts';

const { test, variants } = setupTest({ vitest }, { browser: false });

test.concurrent.for(variants)('core - %s', async (variant, { expect, ...ctx }) => {
	const cwd = await ctx.run(variant, { vitest: {} });

	await expect(execAsync('pnpm install', { cwd })).resolves.toBeTruthy();

	await expect(execAsync('pnpm exec playwright install chromium', { cwd })).resolves.toBeTruthy();

	await expect(execAsync('pnpm test', { cwd })).resolves.toBeTruthy();
});
