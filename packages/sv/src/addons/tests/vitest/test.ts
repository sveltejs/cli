import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'tinyexec';
import vitest from '../../vitest-addon.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ vitest },
	{ kinds: [{ type: 'default', options: { vitest: {} } }], browser: false }
);

test.concurrent.for(testCases)('vitest $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	expect(
		execSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
			nodeOptions: {
				cwd,
				timeout: 2 * 60_000,
				shell: true
			}
		}).exitCode
	).toBe(0);

	expect(
		execSync('pnpm', ['test'], { nodeOptions: { cwd, shell: true, timeout: 2 * 60_000 } }).exitCode
	).toBe(0);

	const viteFile = ['vite.config.ts', 'vite.config.js']
		.map((name) => path.resolve(cwd, name))
		.find((file) => fs.existsSync(file))!;
	const viteContent = fs.readFileSync(viteFile, 'utf8');

	expect(viteContent).toContain(`vitest/config`);
});
