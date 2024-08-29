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

export const adderCategories: AdderCategories = {
	codeQuality: ['prettier', 'eslint'],
	testing: ['vitest', 'playwright'],
	css: ['tailwindcss'],
	db: ['drizzle'],
	additional: ['storybook', 'mdsvex', 'routify']
};

export const adderIds: string[] = Object.values(adderCategories).flatMap((x) => x);

export function getAdderDetails(name: string): AdderWithoutExplicitArgs {
	switch (name) {
		case 'drizzle':
			return drizzle as AdderWithoutExplicitArgs;
		case 'eslint':
			return eslint;
		case 'mdsvex':
			return mdsvex;
		case 'playwright':
			return playwright;
		case 'prettier':
			return prettier;
		case 'routify':
			return routify;
		case 'storybook':
			return storybook;
		case 'tailwindcss':
			return tailwindcss as AdderWithoutExplicitArgs;
		case 'vitest':
			return vitest;
		default:
			throw new Error(`invalid adder name: ${name}`);
	}
}

export function getAdderConfig(name: string) {
	const adder = getAdderDetails(name);
	return adder.config;
}
