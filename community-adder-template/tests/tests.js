import { defineAdderTests } from '@sveltejs/cli-core';
import { options } from '../src/index.js';

export const tests = defineAdderTests({
	options,
	optionValues: [{ demo: true }],
	files: [
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			condition: ({ kit }) => Boolean(kit),
			content: () => '<div class="test"></div>'
		},
		{
			name: () => 'src/App.svelte',
			condition: ({ kit }) => !kit,
			content: () => '<div class="test"></div>'
		}
	],
	tests: [
		{
			name: 'demo test',
			run: async ({ elementExists }) => {
				await elementExists('.test');
			}
		}
	]
});
