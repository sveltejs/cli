import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import devtoolsJson from '../../devtools-json/index.ts';
import fs from 'node:fs';
import path from 'node:path';

const { test, variants } = setupTest({ devtoolsJson }, { browser: false });

test.concurrent.for(variants)('default - %s', async (variant, ctx) => {
	const cwd = await ctx.run(variant, { devtoolsJson: {} });

	const ext = variant.includes('ts') ? 'ts' : 'js';
	const viteFile = path.resolve(cwd, `vite.config.${ext}`);
	const viteContent = fs.readFileSync(viteFile, 'utf8');

	// Check if we have the import part
	expect(viteContent).toContain(`import devtoolsJson from`);
	expect(viteContent).toContain(`vite-plugin-devtools-json`);

	// Check if it's called
	expect(viteContent).toContain(`devtoolsJson()`);
});
