import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import remoteFunctions from '../../remote-functions/index.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = remoteFunctions.id;
const { test, variants, prepareServer } = setupTest({ [addonId]: remoteFunctions });

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const demoName = 'myFavPost';
	const demoNamePlural = 'myFavPosts';
	const kebabPlural = 'my-fav-posts';

	const cwd = await ctx.run(variant, { [addonId]: { withDemo: true, demo: demoName } });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	// check svelte.config.js
	expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('experimental');
	expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('remoteFunctions');
	expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('compilerOptions');
	expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('async');
	expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).toMatch('true');

	// check demo page
	expect(
		await readFile(join(cwd, 'src', 'routes', 'demo', kebabPlural, '+page.svelte'), 'utf8')
	).toMatch(`import { get${demoNamePlural} } from './${kebabPlural}.remote'`);
});
