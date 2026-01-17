/** @import { Fixtures } from '../../../testing.js' */

import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.js';
import vitest from '../../vitest-addon/index.js';
import path from 'node:path';
import fs from 'node:fs';

const { test, testCases } = setupTest(
	{ vitest },
	{ kinds: [{ type: 'default', options: { vitest: {} } }], browser: false }
);

test.concurrent.for(testCases)(
	'vitest $variant',
	(testCase, /** @type {Fixtures & import('vitest').TestContext} */ ctx) => {
		const cwd = ctx.cwd(testCase);
		const expect = ctx.expect;

		expect(() => execSync('pnpm install', { cwd, stdio: 'pipe' })).not.toThrow();

		expect(() => execSync('pnpm exec playwright install chromium', { cwd })).not.toThrow();

		expect(() => execSync('pnpm test', { cwd, stdio: 'pipe' })).not.toThrow();

		const language = testCase.variant.includes('ts') ? 'ts' : 'js';
		const viteFile = path.resolve(cwd, `vite.config.${language}`);
		const viteContent = fs.readFileSync(viteFile, 'utf8');

		expect(viteContent).toContain(`vitest/config`);
	}
);
