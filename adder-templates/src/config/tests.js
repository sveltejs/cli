import { defineAdderTests } from '@svelte-cli/core';
import { options } from './options.js';

export const tests = defineAdderTests({
	files: [],
	options,
	optionValues: [{ demoOption: true }],
	tests: [
		{
			name: 'demo test',
			run: async ({ elementExists }) => {
				await elementExists('.test');
			}
		}
	]
});
