import type { AdderCategories } from './categories';
import type { AdderWithoutExplicitArgs } from '@svelte-cli/core';

// adders
import drizzle from '../drizzle';
import eslint from '../eslint';
import mdsvex from '../mdsvex';
import playwright from '../playwright';
import prettier from '../prettier';
import routify from '../routify';
import storybook from '../storybook';
import tailwindcss from '../tailwindcss';
import vitest from '../vitest';

const categories = {
	codeQuality: [prettier, eslint],
	testing: [vitest, playwright],
	css: [tailwindcss],
	db: [drizzle],
	additional: [storybook, mdsvex, routify]
};

export const adderCategories: AdderCategories = getCategoriesById();

function getCategoriesById(): AdderCategories {
	const adderCategories: any = {};
	for (const [key, adders] of Object.entries(categories)) {
		adderCategories[key] = adders.map((a) => a.config.metadata.id);
	}
	return adderCategories;
}

export const adderIds: string[] = Object.values(adderCategories).flatMap((x) => x);

const adderDetails = Object.values(categories).flat();

export function getAdderDetails(name: string): AdderWithoutExplicitArgs {
	const details = adderDetails.find((a) => a.config.metadata.id === name);
	if (!details) {
		throw new Error(`invalid adder name: ${name}`);
	}

	return details as AdderWithoutExplicitArgs;
}
