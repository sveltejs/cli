import type { Addon, AddonDefinition } from '../core/config.ts';
import aiTools from './ai-tools.ts';
import betterAuth from './better-auth.ts';
import drizzle from './drizzle.ts';
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

/** Keyed by `addon.id`. */
type OfficialAddons = {
	prettier: Addon<any>;
	eslint: Addon<any>;
	vitest: Addon<any>;
	playwright: Addon<any>;
	tailwindcss: Addon<any>;
	'sveltekit-adapter': Addon<any>;
	drizzle: Addon<any>;
	'better-auth': Addon<any>;
	mdsvex: Addon<any>;
	paraglide: Addon<any>;
	storybook: Addon<any>;
	'ai-tools': Addon<any>;
	experimental: Addon<any>;
};

export type OfficialAddonId = keyof OfficialAddons;

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
export const officialAddons: OfficialAddons = {
	[prettier.id]: prettier,
	[eslint.id]: eslint,
	[vitest.id]: vitest,
	[playwright.id]: playwright,
	[tailwindcss.id]: tailwindcss,
	[sveltekitAdapter.id]: sveltekitAdapter,
	[drizzle.id]: drizzle,
	[betterAuth.id]: betterAuth,
	[mdsvex.id]: mdsvex,
	[paraglide.id]: paraglide,
	[storybook.id]: storybook,
	[aiTools.id]: aiTools,
	[experimental.id]: experimental
};

export function getAddonDetails(id: string): AddonDefinition {
	const details = Object.values(officialAddons).find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details as AddonDefinition;
}
