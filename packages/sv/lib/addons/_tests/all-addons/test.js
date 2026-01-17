/** @import { AddonMap, OptionMap } from '../../../addons/add.js' */
/** @import { Fixtures } from '../../../testing.js' */

import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.js';
import { officialAddons } from '../../_config/official.js';

const windowsCI = process.env.CI && process.platform === 'win32';
const addons = Object.values(officialAddons).reduce(
	/** @param {AddonMap} addonMap */
	(addonMap, addon) => {
		if (addon.id === 'storybook' && windowsCI) return addonMap;
		addonMap[addon.id] = addon;
		return addonMap;
	},
	/** @type {AddonMap} */ ({})
);

const defaultOptions = Object.values(officialAddons).reduce(
	/** @param {OptionMap<typeof addons>} options */
	(options, addon) => {
		options[addon.id] = {};
		return options;
	},
	/** @type {OptionMap<typeof addons>} */ ({})
);

const { test, testCases } = setupTest(addons, {
	kinds: [{ type: 'default', options: defaultOptions }],
	filter: (addonTestCase) => addonTestCase.variant.startsWith('kit'),
	browser: false
});

test.concurrent.for(testCases)(
	'run all addons - $variant',
	(testCase, /** @type {Fixtures} */ ctx) => {
		const cwd = ctx.cwd(testCase);

		expect(cwd).toBeDefined();
	}
);
