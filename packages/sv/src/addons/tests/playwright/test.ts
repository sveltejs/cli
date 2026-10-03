import fs from 'node:fs';
import path from 'node:path';
import playwright from '../../playwright.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ playwright },
	{
		kinds: [
			{ type: 'demo', options: { playwright: { demo: true } } },
			{ type: 'no-demo', options: { playwright: { demo: false } } }
		],
		browser: false
	}
);

test.concurrent.for(testCases)('playwright $kind.type $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const language = testCase.variant.includes('ts') ? 'ts' : 'js';
	const playwrightConfig = path.resolve(cwd, `playwright.config.${language}`);
	const configContent = fs.readFileSync(playwrightConfig, 'utf8');

	expect(configContent).toContain(`import { defineConfig } from`);
	expect(configContent).toContain(`@playwright/test`);

	// Check if it's called
	expect(configContent).toContain(`export default defineConfig({`);

	if (!testCase.variant.startsWith('kit')) return;

	const demoDir = path.resolve(cwd, 'src/routes/demo');
	const withDemo = testCase.kind.type === 'demo';
	expect(fs.existsSync(demoDir)).toBe(withDemo);
	expect(fs.existsSync(path.resolve(demoDir, 'playwright/+page.svelte'))).toBe(withDemo);
	expect(fs.existsSync(path.resolve(demoDir, `playwright/page.svelte.e2e.${language}`))).toBe(
		withDemo
	);
	expect(fs.existsSync(path.resolve(cwd, `src/routes/page.svelte.e2e.${language}`))).toBe(
		!withDemo
	);
});
