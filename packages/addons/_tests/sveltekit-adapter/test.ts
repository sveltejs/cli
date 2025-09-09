import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sveltekitAdapter from '../../sveltekit-adapter/index.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = sveltekitAdapter.id;
const { test, variants, prepareServer } = setupTest(
	{ [addonId]: sveltekitAdapter },
	{ skipBrowser: true }
);

const kitOnly = variants.filter((v) => v.includes('kit'));
test.concurrent.for(kitOnly)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { [addonId]: { adapter: 'node' } });

	const { close } = await prepareServer({
		cwd,
		page,
		installCommand: variant.includes('ts') ? undefined : null!,
		buildCommand: variant.includes('ts') ? undefined : null!
	});
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(await readFile(join(cwd, 'svelte.config.js'), 'utf8')).not.toMatch('adapter-auto');
});
