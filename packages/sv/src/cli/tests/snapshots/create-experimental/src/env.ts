import { defineEnvVars } from '@sveltejs/kit/hooks';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	BETTER_AUTH_SECRET: {
		description: 'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	GITHUB_CLIENT_ID: {
		description: 'GitHub OAuth client ID. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).'
	},
	GITHUB_CLIENT_SECRET: {
		description: 'GitHub OAuth client secret. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).'
	}
});
