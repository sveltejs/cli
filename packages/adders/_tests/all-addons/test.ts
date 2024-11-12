import process from 'node:process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import { officialAdders } from '../../index.ts';

const windowsCI = process.env.CI && process.platform === 'win32';
const addons = officialAdders.reduce((addonMap, addon) => {
	if (addon.id === 'storybook' && windowsCI) return addonMap;
	addonMap[addon.id] = addon;
	return addonMap;
}, {} as any);

const defaultOptions = officialAdders.reduce((options, addon) => {
	options[addon.id] = {};
	for (const [id, question] of Object.entries(addon.options)) {
		if (question.condition?.(options[addon.id]) !== false) {
			options[addon.id][id] ??= question.default;
		}
	}
	return options;
}, {} as any);

const { test, variants, prepareServer } = setupTest({ addons });

test.concurrent.for(variants)('run all addons - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, defaultOptions);

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	expect(true).toBe(true);
});
