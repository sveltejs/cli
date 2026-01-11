import { execSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import quickpickle from '../../quickpickle/index.ts';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

// we're including the `eslint` add-on to prevent `storybook` from modifying this repo's `eslint.config.js`
const { test, testCases, prepareServer } = setupTest(
	{ quickpickle },
	{ kinds: [{ type: 'default', options: { quickpickle: {} } }] }
);

test.for(testCases)('quickpickle $variant', async (testCase, { page, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	// Check that the VS Code settings file was created
	const vscodeSettings = resolve(cwd, '.vscode/settings.json');
	const vscodeSettingsContent = await readFile(vscodeSettings, 'utf8');
	expect(vscodeSettingsContent).toContain('"cucumber.glue"');
	expect(vscodeSettingsContent).toContain('"cucumberautocomplete.steps"');

	// Run the SvelteKit dev server
	const { close } = await prepareServer({
		cwd,
		page,
		buildCommand: '',
		previewCommand: `pnpm dev`
	});

	await expect(page.locator('body')).toBeVisible();
	await expect(page.locator('h1')).toContainText('Svelte');

	// Run the quickpickle tests
	const result = execSync('pnpm test --no-watch --no-color', { cwd, stdio: 'pipe' });

	// Assert that the tests passed
	expect(result.toString()).toContain('✓ |e2e| tests/front.feature');

	// Kill server process when we're done
	ctx.onTestFinished(async () => await close());
});
