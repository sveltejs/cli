import type { AdderCategories, Category } from './categories.ts';
import type { AdderWithoutExplicitArgs, Adder } from '@svelte-cli/core';

// adders
import drizzle from '../drizzle/index.ts';
import eslint from '../eslint/index.ts';
import lucia from '../lucia/index.ts';
import mdsvex from '../mdsvex/index.ts';
import playwright from '../playwright/index.ts';
import prettier from '../prettier/index.ts';
import routify from '../routify/index.ts';
import storybook from '../storybook/index.ts';
import tailwindcss from '../tailwindcss/index.ts';
import vitest from '../vitest/index.ts';

const categories: Record<Category, Array<Adder<any>>> = {
	'Code Quality': [prettier, eslint],
	Testing: [vitest, playwright],
	CSS: [tailwindcss],
	Database: [drizzle],
	Auth: [lucia],
	'Additional Functionality': [storybook, mdsvex, routify]
};

export const adderCategories: AdderCategories = getCategoriesById();

function getCategoriesById(): AdderCategories {
	const adderCategories: any = {};
	for (const [key, adders] of Object.entries(categories)) {
		adderCategories[key] = adders.map((a) => a.id);
	}
	return adderCategories;
}

export const adderIds: string[] = Object.values(adderCategories).flatMap((x) => x);

const adderDetails = Object.values(categories).flat();

export function getAdderDetails(name: string): AdderWithoutExplicitArgs {
	const details = adderDetails.find((a) => a.id === name);
	if (!details) {
		throw new Error(`Invalid adder name: ${name}`);
	}

	return details as AdderWithoutExplicitArgs;
}
