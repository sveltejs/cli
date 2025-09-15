import fs from 'node:fs';
import path from 'node:path';
import { setupTest } from '../_setup/suite.ts';
import playwright from '../../playwright/index.ts';

const { test, variants } = setupTest({ playwright }, { browser: false });

test.concurrent.for(variants)('core - %s', async (variant, { expect, ...ctx }) => {
	const cwd = await ctx.run(variant, { playwright: {} });

	const ext = variant.includes('ts') ? 'ts' : 'js';
	const playwrightConfig = path.resolve(cwd, `playwright.config.${ext}`);
	const configContent = fs.readFileSync(playwrightConfig, 'utf8');

	// Check if we have the imports
	expect(configContent).toContain(`import { defineConfig } from`);
	expect(configContent).toContain(`@playwright/test`);

	// Check if it's called
	expect(configContent).toContain(`export default defineConfig({`);
});
