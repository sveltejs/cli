import { defineAdderTests } from '@svelte-cli/core';

export const tests = defineAdderTests({
	files: [],
	options: {},
	optionValues: [],
	tests: [
		{
			name: 'check page switch',
			run: async ({ elementExists, click, expectUrlPath }) => {
				await elementExists('.routify-demo');
				expectUrlPath('/');

				await click('.routify-demo .demo', '/demo');
				expectUrlPath('/demo');

				await click('.routify-demo .index', '/');
				expectUrlPath('/');
			}
		}
	]
});
