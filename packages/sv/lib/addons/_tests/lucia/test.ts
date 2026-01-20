import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import lucia from '../../lucia/index.ts';
import drizzle from '../../drizzle/index.ts';
import path from 'node:path';
import fs from 'node:fs';

const { test, testCases } = setupTest(
	{ drizzle, lucia },
	{
		kinds: [
			{
				type: 'default',
				options: { drizzle: { database: 'sqlite', sqlite: 'libsql' }, lucia: { demo: true } }
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit'),
		browser: false
	}
);

test.concurrent.for(testCases)('lucia $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const language = testCase.variant.includes('ts') ? 'ts' : 'js';
	const filePath = path.resolve(cwd, `src/routes/demo/lucia/+page.server.${language}`);
	const fileContent = fs.readFileSync(filePath, 'utf8');
	expect(fileContent).toContain(`export const actions`);
});
