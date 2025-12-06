import type { Addon, AddonWithoutExplicitArgs } from '@sveltejs/cli-core';

import devtoolsJson from '../devtools-json/index.ts';
import drizzle from '../drizzle/index.ts';
import eslint from '../eslint/index.ts';
import lucia from '../lucia/index.ts';
import mdsvex from '../mdsvex/index.ts';
import paraglide from '../paraglide/index.ts';
import mcp from '../mcp/index.ts';
import playwright from '../playwright/index.ts';
import prettier from '../prettier/index.ts';
import storybook from '../storybook/index.ts';
import sveltekitAdapter from '../sveltekit-adapter/index.ts';
import tailwindcss from '../tailwindcss/index.ts';
import vitest from '../vitest-addon/index.ts';

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
	mcp: Addon<any>;
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
	mcp
};

export function getAddonDetails(id: string): AddonWithoutExplicitArgs {
	const details = Object.values(officialAddons).find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details as AddonWithoutExplicitArgs;
}
