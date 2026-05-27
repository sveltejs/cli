import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fontless from '../../fontless.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ fontless },
	{
		kinds: [{ type: 'default', options: { fontless: {} } }],
		browser: false
	}
);

test.concurrent.for(testCases)('fontless $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const ext = testCase.variant.split('-')[1];
	expect(readFileSync(join(cwd, `vite.config.${ext}`), 'utf8')).toMatch('fontless');
});
