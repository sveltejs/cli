import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon.ts';
import path from 'node:path';
import fs from 'node:fs';

const { test, testCases } = setupTest(
	{ vitest },
	{ kinds: [{ type: 'default', options: { vitest: {} } }], browser: false }
);

test.concurrent.for(testCases)('vitest $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	expect(() => execSync('pnpm exec playwright install chromium', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm test', { cwd, stdio: 'pipe', timeout: 120_000 })).not.toThrow();

	const language = testCase.variant.includes('ts') ? 'ts' : 'js';
	const viteFile = path.resolve(cwd, `vite.config.${language}`);
	const viteContent = fs.readFileSync(viteFile, 'utf8');

	expect(viteContent).toContain(`vitest/config`);
});
