import { defineAdderOptions, colors } from '@svelte-cli/core';

export const options = defineAdderOptions({
	demo: {
		type: 'boolean',
		default: false,
		question: `Do you want to include a demo? ${colors.dim('(includes a login/register page)')}`
	}
});
