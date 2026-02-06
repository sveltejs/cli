import type { Addon, AddonDefinition } from '../../core.ts';
import ai from '../ai.ts';
import devtoolsJson from '../devtools-json.ts';
import drizzle from '../drizzle.ts';
import eslint from '../eslint.ts';
import lucia from '../lucia.ts';
import mdsvex from '../mdsvex.ts';
import paraglide from '../paraglide.ts';
import playwright from '../playwright.ts';
import prettier from '../prettier.ts';
import storybook from '../storybook.ts';
import sveltekitAdapter from '../sveltekit-adapter.ts';
import tailwindcss from '../tailwindcss.ts';
import vitest from '../vitest-addon.ts';

type OfficialAddons = {
	prettier: Addon<any>;
	eslint: Addon<any>;
	vitest: Addon<any>;
	playwright: Addon<any>;
	tailwindcss: Addon<any>;
	sveltekitAdapter: Addon<any>;
	devtoolsJson: Addon<any>;
	drizzle: Addon<any>;
	lucia: Addon<any>;
	mdsvex: Addon<any>;
	paraglide: Addon<any>;
	storybook: Addon<any>;
	ai: Addon<any>;
};

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
export const officialAddons: OfficialAddons = {
	prettier,
	eslint,
	vitest,
	playwright,
	tailwindcss,
	sveltekitAdapter,
	devtoolsJson,
	drizzle,
	lucia,
	mdsvex,
	paraglide,
	storybook,
	ai
};

export function getAddonDetails(id: string): AddonDefinition {
	const details = Object.values(officialAddons).find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details as AddonDefinition;
}
