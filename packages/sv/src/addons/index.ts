import type { AddonDefinition } from '../core/config.ts';
import aiTools from './ai-tools.ts';
import betterAuth from './better-auth.ts';
import drizzle from './drizzle.ts';
import enhancedImg from './enhanced-img.ts';
import eslint from './eslint.ts';
import experimental from './experimental.ts';
import mdsvex from './mdsvex.ts';
import type { OfficialAddons } from './options.ts';
import paraglide from './paraglide.ts';
import playwright from './playwright.ts';
import prettier from './prettier.ts';
import storybook from './storybook.ts';
import sveltekitAdapter from './sveltekit-adapter.ts';
import tailwindcss from './tailwindcss.ts';
import vitest from './vitest-addon.ts';

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
export const officialAddons: OfficialAddons = {
	prettier,
	eslint,
	vitest,
	playwright,
	tailwindcss,
	enhancedImg,
	sveltekitAdapter,
	drizzle,
	betterAuth,
	mdsvex,
	paraglide,
	storybook,
	aiTools,
	experimental
};

export function getAddonDetails(id: string): AddonDefinition {
	const details = Object.values(officialAddons).find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details as AddonDefinition;
}
