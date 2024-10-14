import type { AdderWithoutExplicitArgs } from '@sveltejs/cli-core';

import drizzle from '../drizzle/index.ts';
import eslint from '../eslint/index.ts';
import lucia from '../lucia/index.ts';
import mdsvex from '../mdsvex/index.ts';
import paraglide from '../paraglide/index.ts';
import playwright from '../playwright/index.ts';
import prettier from '../prettier/index.ts';
import routify from '../routify/index.ts';
import storybook from '../storybook/index.ts';
import tailwindcss from '../tailwindcss/index.ts';
import vitest from '../vitest/index.ts';

export const adders = [
	drizzle,
	eslint,
	lucia,
	mdsvex,
	paraglide,
	playwright,
	prettier,
	routify,
	storybook,
	tailwindcss,
	vitest
];

export function getAdderDetails(id: string): AdderWithoutExplicitArgs {
	const details = adders.find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid adder: ${id}`);
	}

	return details as AdderWithoutExplicitArgs;
}
