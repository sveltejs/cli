import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import { officialAddons } from '../../index.ts';
import type { AddonMap, OptionMap } from '../../../cli/utils/engine.ts';

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

const { test, testCases } = setupTest(addons, {
	kinds: [{ type: 'default', options: defaultOptions }],
	filter: (addonTestCase) => addonTestCase.variant.startsWith('kit'),
	browser: false
});

test.concurrent.for(testCases)('run all addons - $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	expect(cwd).toBeDefined();
});
