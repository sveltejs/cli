import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import { officialAddons } from '../../index.ts';
import type { AddonMap, OptionMap } from 'sv';

const windowsCI = process.env.CI && process.platform === 'win32';
const addons = Object.values(officialAddons).reduce<AddonMap>((addonMap, addon) => {
	if (addon.id === 'storybook' && windowsCI) return addonMap;
	addonMap[addon.id] = addon;
	return addonMap;
}, {});

const defaultOptions = Object.values(officialAddons).reduce<OptionMap<typeof addons>>(
	(options, addon) => {
		options[addon.id] = {};
		return options;
	},
	{}
);

const { test, testCases, prepareServer } = setupTest(addons, {
	kinds: [{ type: 'default', options: defaultOptions }],
	filter: (addonTestCase) => addonTestCase.variant.startsWith('kit')
});

test.concurrent.for(testCases)('run all addons - $variant', async (testCase, { page, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
