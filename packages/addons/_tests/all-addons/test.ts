import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import { officialAddons } from '../../index.ts';
import type { AddonMap, OptionMap } from 'sv';

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

const { test, flavors, prepareServer } = setupTest(addons, {
	kinds: [{ type: 'default', options: defaultOptions }],
	filter: (flavor) => flavor.variant.startsWith('kit')
});

test.concurrent.for(flavors)('run all addons - $variant', async (flavor, { page, ...ctx }) => {
	const cwd = ctx.run(flavor);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
