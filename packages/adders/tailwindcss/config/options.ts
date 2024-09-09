import { defineAdderOptions } from '@svelte-cli/core';

export const options = defineAdderOptions({
	plugins: {
		type: 'multiselect',
		question: 'Which plugins would you like to add?',
		options: [{ value: 'typography', label: 'Typography' }],
		default: []
	}
});
