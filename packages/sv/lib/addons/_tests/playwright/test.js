/** @import { Fixtures } from '../../../testing.js' */

import fs from 'node:fs';
import path from 'node:path';
import { setupTest } from '../_setup/suite.js';
import playwright from '../../playwright/index.js';

const { test, testCases } = setupTest(
	{ playwright },
	{ kinds: [{ type: 'default', options: { playwright: {} } }], browser: false }
);

test.concurrent.for(testCases)(
	'playwright $variant',
	(testCase, /** @type {Fixtures & import('vitest').TestContext} */ ctx) => {
		const cwd = ctx.cwd(testCase);
		const expect = ctx.expect;

		const language = testCase.variant.includes('ts') ? 'ts' : 'js';
		const playwrightConfig = path.resolve(cwd, `playwright.config.${language}`);
		const configContent = fs.readFileSync(playwrightConfig, 'utf8');

		expect(configContent).toContain(`import { defineConfig } from`);
		expect(configContent).toContain(`@playwright/test`);

		// Check if it's called
		expect(configContent).toContain(`export default defineConfig({`);
	}
);
