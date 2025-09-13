import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon/index.ts';

const { test, variants } = setupTest({ vitest }, { browser: false });

test.concurrent.for(variants)('core - %s', async (variant, { expect, ...ctx }) => {
	const cwd = await ctx.run(variant, { vitest: {} });

	expect(() => execSync('pnpm install', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm exec playwright install chromium', { cwd })).not.toThrow();

	expect(() => execSync('pnpm test', { cwd, stdio: 'pipe' })).not.toThrow();
});
