/**
 * Official add-on ids, declared without importing the add-ons themselves so that
 * add-ons can reference each other in `dependsOn`/`runsAfter` without import cycles.
 */
export const ADDON_IDS = {
	prettier: 'prettier',
	eslint: 'eslint',
	vitest: 'vitest',
	playwright: 'playwright',
	tailwindcss: 'tailwindcss',
	enhancedImg: 'enhanced-img',
	sveltekitAdapter: 'sveltekit-adapter',
	drizzle: 'drizzle',
	betterAuth: 'better-auth',
	mdsvex: 'mdsvex',
	paraglide: 'paraglide',
	storybook: 'storybook',
	aiTools: 'ai-tools',
	experimental: 'experimental'
} as const;

export type OfficialAddonId = (typeof ADDON_IDS)[keyof typeof ADDON_IDS];
