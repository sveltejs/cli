import { defineAdderOptions } from '@svelte-cli/core';

export const options = defineAdderOptions({
	demo: {
		question: 'Do you want to use a demo?',
		type: 'boolean',
		default: false
	}
});
