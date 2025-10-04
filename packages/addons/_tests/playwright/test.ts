import fs from 'node:fs';
import path from 'node:path';
import { setupTest } from '../_setup/suite.ts';
import playwright from '../../playwright/index.ts';

const { test, addonTestCases } = setupTest(
	{ playwright },
	{ kinds: [{ type: 'default', options: { playwright: {} } }], browser: false }
);

test.concurrent.for(addonTestCases)('playwright $variant', (addonTestCase, { expect, ...ctx }) => {
	const cwd = ctx.run(addonTestCase);

	const ext = addonTestCase.variant.includes('ts') ? 'ts' : 'js';
	const playwrightConfig = path.resolve(cwd, `playwright.config.${ext}`);
	const configContent = fs.readFileSync(playwrightConfig, 'utf8');

	// Check if we have the imports
	expect(configContent).toContain(`import { defineConfig } from`);
	expect(configContent).toContain(`@playwright/test`);

	// Check if it's called
	expect(configContent).toContain(`export default defineConfig({`);
});
