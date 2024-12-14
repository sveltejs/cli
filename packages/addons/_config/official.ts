import type { AddonWithoutExplicitArgs } from '@sveltejs/cli-core';

import drizzle from '../drizzle/index.ts';
import eslint from '../eslint/index.ts';
import lucia from '../lucia/index.ts';
import mdsvex from '../mdsvex/index.ts';
import paraglide from '../paraglide/index.ts';
import playwright from '../playwright/index.ts';
import prettier from '../prettier/index.ts';
import storybook from '../storybook/index.ts';
import tailwindcss from '../tailwindcss/index.ts';
import vitest from '../vitest-addon/index.ts';

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
export const officialAddons = [
	prettier,
	eslint,
	vitest,
	playwright,
	tailwindcss,
	drizzle,
	lucia,
	mdsvex,
	paraglide,
	storybook
] as AddonWithoutExplicitArgs[];

export function getAddonDetails(id: string): AddonWithoutExplicitArgs {
	const details = officialAddons.find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details as AddonWithoutExplicitArgs;
}
