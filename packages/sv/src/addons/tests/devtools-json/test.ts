import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import devtoolsJson from '../../devtools-json.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ devtoolsJson },
	{ kinds: [{ type: 'default', options: { [devtoolsJson.id]: {} } }], browser: false }
);

test.concurrent.for(testCases)('devtools-json $variant', (testCase, ctx) => {
	const cwd = ctx.cwd(testCase);

	const language = testCase.variant.includes('ts') ? 'ts' : 'js';
	const hooksFile = path.resolve(cwd, `src/hooks.server.${language}`);
	const hooksContent = fs.readFileSync(hooksFile, 'utf8');

	expect(hooksContent).toContain(`handleDevtoolsJson`);
	expect(hooksContent).toContain(`com.chrome.devtools.json`);
	expect(hooksContent).toContain(`from '$app/environment'`);
});
