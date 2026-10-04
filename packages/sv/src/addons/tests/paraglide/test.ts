import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import paraglide from '../../paraglide.ts';
import { setupTest } from '../_setup/suite.ts';

const langs = ['en', 'fr', 'hu', 'en'];

const { test, testCases, prepareServer } = setupTest(
	{ paraglide },
	{
		kinds: [
			{ type: 'default', options: { paraglide: { demo: true, languageTags: langs.join(',') } } }
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit')
	}
);

test.concurrent.for(testCases)('paraglide $variant', async (testCase, { page, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	for (const lang of langs) {
		const filePath = path.resolve(cwd, `src/lib/paraglide/messages/${lang}.js`);
		const fileContent = fs.readFileSync(filePath, 'utf8');
		expect(fileContent).toContain(`hello_world`);
	}

	const settingsPath = path.resolve(cwd, 'project.inlang/settings.json');
	const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
	expect(settings.locales).toEqual(['en', 'fr', 'hu']);

	const declarationsPath = path.resolve(cwd, 'src/lib/paraglide/messages/_index.d.ts');
	const declarations = fs.readFileSync(declarationsPath, 'utf8');
	expect(declarations).toContain('hello_world');
});
