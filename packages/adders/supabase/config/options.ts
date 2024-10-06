import { colors, defineAdderOptions } from '@svelte-cli/core';

export const options = defineAdderOptions({
	auth: {
		question: 'What authentication methods would you like?',
		type: 'multiselect',
		default: [],
		options: [
			{
				hint: 'Email and password',
				label: 'Basic authentication',
				value: 'basic'
			},
			{
				hint: 'Magic link',
				label: 'Magic link',
				value: 'magic-link'
			}
		]
	},
	cli: {
		question: 'Do you want to install the Supabase CLI for local development?',
		type: 'boolean',
		default: true
	},
	admin: {
		question: `Do you want to add a Supabase admin client? ${colors.red('Warning: This client bypasses row level security, only use server side.')}`,
		type: 'boolean',
		default: false
	},
	helpers: {
		question: `Do you want to add Supabase helper scripts to your package.json? E.g., ${colors.yellow('db:reset')} and ${colors.yellow('db:migration')}`,
		type: 'boolean',
		default: false,
		condition: ({ cli }) => cli === true
	},
	demo: {
		question: 'Do you want to include demo routes to show protected routes?',
		type: 'boolean',
		default: false,
		condition: ({ auth }) => auth.includes('basic') || auth.includes('magic-link')
	}
});
