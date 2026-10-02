import type { Addon, AddonDefinition } from '../core/config.ts';
import type { OptionMap } from '../core/engine.ts';
import { ADDON_IDS, type OfficialAddonId } from './ids.ts';
import aiTools from './ai-tools.ts';
import betterAuth from './better-auth.ts';
import drizzle from './drizzle.ts';
import enhancedImg from './enhanced-img.ts';
import eslint from './eslint.ts';
import experimental from './experimental.ts';
import mdsvex from './mdsvex.ts';
import paraglide from './paraglide.ts';
import playwright from './playwright.ts';
import prettier from './prettier.ts';
import storybook from './storybook.ts';
import sveltekitAdapter from './sveltekit-adapter.ts';
import tailwindcss from './tailwindcss.ts';
import vitest from './vitest-addon.ts';

type OfficialAddonRegistry = { [Id in OfficialAddonId]: Addon<any, Id> };

export type { OfficialAddonId };

/** What `add()` accepts as `options` for official add-ons, keyed by add-on id. */
export type OfficialAddonOptions = OptionMap<OfficialAddons>;

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
export const officialAddons = {
	[ADDON_IDS.prettier]: prettier,
	[ADDON_IDS.eslint]: eslint,
	[ADDON_IDS.vitest]: vitest,
	[ADDON_IDS.playwright]: playwright,
	[ADDON_IDS.tailwindcss]: tailwindcss,
	[ADDON_IDS.enhancedImg]: enhancedImg,
	[ADDON_IDS.sveltekitAdapter]: sveltekitAdapter,
	[ADDON_IDS.drizzle]: drizzle,
	[ADDON_IDS.betterAuth]: betterAuth,
	[ADDON_IDS.mdsvex]: mdsvex,
	[ADDON_IDS.paraglide]: paraglide,
	[ADDON_IDS.storybook]: storybook,
	[ADDON_IDS.aiTools]: aiTools,
	[ADDON_IDS.experimental]: experimental
} satisfies OfficialAddonRegistry;

export type OfficialAddons = typeof officialAddons;

export function getAddonDetails(id: string): AddonDefinition {
	const details = officialAddons[id as OfficialAddonId];
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details as AddonDefinition;
}
