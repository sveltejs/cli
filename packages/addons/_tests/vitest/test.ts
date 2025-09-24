import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon/index.ts';
import path from 'node:path';
import fs from 'node:fs';

const { test, variants } = setupTest({ vitest }, { browser: false });

test.concurrent.for(variants)('core - %s', async (variant, { expect, ...ctx }) => {
	const cwd = await ctx.run(variant, { vitest: {} });

	expect(() => execSync('pnpm install', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm exec playwright install chromium', { cwd })).not.toThrow();

	expect(() => execSync('pnpm test', { cwd, stdio: 'pipe' })).not.toThrow();

	const ext = variant.includes('ts') ? 'ts' : 'js';
	const viteFile = path.resolve(cwd, `vite.config.${ext}`);
	const viteContent = fs.readFileSync(viteFile, 'utf8');

	expect(viteContent).toContain(`vitest/config`);
});
