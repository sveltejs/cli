import { defineEnvVars } from '@sveltejs/kit/hooks';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'Connection string for the database' },
	ORIGIN: { description: 'App origin / base URL' },
	BETTER_AUTH_SECRET: { description: 'Secret used by better-auth' },
	GITHUB_CLIENT_ID: {},
	GITHUB_CLIENT_SECRET: {}
});
