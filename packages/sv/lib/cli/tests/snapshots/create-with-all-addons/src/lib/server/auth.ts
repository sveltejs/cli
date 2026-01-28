import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: { enabled: true },
	// Example of social provider (uncomment to enable GitHub OAuth)
	// Don't forget to set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your .env file
	// socialProviders: {
	// 	github: {
	// 		clientId: env.GITHUB_CLIENT_ID,
	// 		clientSecret: env.GITHUB_CLIENT_SECRET,
	// 	},
	// },
	plugins: [sveltekitCookies(getRequestEvent)] // make sure this is the last plugin in the array
});
