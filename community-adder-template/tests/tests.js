import { defineAdderTests } from '@sveltejs/cli-core';
import { options } from '../src/index.js';

export const tests = defineAdderTests({
	files: [],
	options,
	optionValues: [{ demo: true }],
	tests: [
		{
			name: 'demo test',
			run: async ({ elementExists }) => {
				await elementExists('.test');
			}
		}
	]
});
