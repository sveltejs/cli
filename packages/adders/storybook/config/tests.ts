import { defineAdderTests } from '@svelte-cli/core';
import { options } from './options.ts';

let port = 6006;

export const tests = defineAdderTests({
	options,
	optionValues: [],
	get command() {
		return `storybook -p ${port++} --ci`;
	},
	files: [],
	tests: [
		{
			name: 'storybook loaded',
			run: async ({ elementExists }) => {
				await elementExists('main .sb-bar');
				await elementExists('#storybook-preview-wrapper');
			}
		}
	]
});
