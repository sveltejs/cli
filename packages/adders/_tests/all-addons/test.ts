import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import { officialAdders } from '../../index.ts';
import type { AddonMap, OptionMap } from 'sv';

const windowsCI = process.env.CI && process.platform === 'win32';
const addons = officialAdders.reduce<AddonMap>((addonMap, addon) => {
	if (addon.id === 'storybook' && windowsCI) return addonMap;
	addonMap[addon.id] = addon;
	return addonMap;
}, {});

const defaultOptions = officialAdders.reduce<OptionMap<typeof addons>>((options, addon) => {
	options[addon.id] = {};
	// TODO: we shouldn't have to apply defaults here
	// applies defaults
	for (const [id, question] of Object.entries(addon.options)) {
		if (question.condition?.(options[addon.id]) !== false) {
			options[addon.id][id] ??= question.default;
		}
	}
	return options;
}, {});

const { test, variants, prepareServer } = setupTest(addons);

const kitOnly = variants.filter((v) => v.startsWith('kit'));
test.concurrent.for(kitOnly)('run all addons - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, defaultOptions);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
