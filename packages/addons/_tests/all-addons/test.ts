import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import { officialAddons } from '../../index.ts';
import type { AddonMap, OptionMap } from 'sv';
import { execSync } from 'node:child_process';

const windowsCI = process.env.CI && process.platform === 'win32';
const addons = officialAddons.reduce<AddonMap>((addonMap, addon) => {
	if (addon.id === 'storybook' && windowsCI) return addonMap;
	addonMap[addon.id] = addon;
	return addonMap;
}, {});

const defaultOptions = officialAddons.reduce<OptionMap<typeof addons>>((options, addon) => {
	options[addon.id] = {};
	return options;
}, {});

const { test, variants, prepareServer } = setupTest(addons);

const kitOnly = variants.filter((v) => v.startsWith('kit'));
test.concurrent.for(kitOnly)('run all addons - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, defaultOptions);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	// all files that we generated should be linted
	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).not.toThrowError();

	expect(true).toBe(true);
});
