import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vitest from '../../vitest-addon.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ vitest },
	{ kinds: [{ type: 'default', options: { vitest: {} } }], browser: false }
);

test.concurrent.for(testCases)('vitest $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	expect(
		spawnSync('pnpm exec playwright install chromium', {
			cwd,
			stdio: 'pipe',
			shell: true,
			timeout: 2 * 60_000
		}).status
	).toBe(0);

	expect(
		spawnSync('pnpm test', { cwd, stdio: 'pipe', shell: true, timeout: 2 * 60_000 }).status
	).toBe(0);

	const language = testCase.variant.includes('ts') ? 'ts' : 'js';
	const viteFile = path.resolve(cwd, `vite.config.${language}`);
	const viteContent = fs.readFileSync(viteFile, 'utf8');

	expect(viteContent).toContain(`vitest/config`);
});
