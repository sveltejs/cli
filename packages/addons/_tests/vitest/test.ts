import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon/index.ts';
import path from 'node:path';
import fs from 'node:fs';

const { test, addonTestCases } = setupTest(
	{ vitest },
	{ kinds: [{ type: 'default', options: { vitest: {} } }], browser: false }
);

test.concurrent.for(addonTestCases)('vitest $variant', (addonTestCase, { expect, ...ctx }) => {
	const cwd = ctx.run(addonTestCase);

	expect(() => execSync('pnpm install', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm exec playwright install chromium', { cwd })).not.toThrow();

	expect(() => execSync('pnpm test', { cwd, stdio: 'pipe' })).not.toThrow();

	const ext = addonTestCase.variant.includes('ts') ? 'ts' : 'js';
	const viteFile = path.resolve(cwd, `vite.config.${ext}`);
	const viteContent = fs.readFileSync(viteFile, 'utf8');

	expect(viteContent).toContain(`vitest/config`);
});
