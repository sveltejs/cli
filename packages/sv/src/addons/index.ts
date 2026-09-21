import type { Addon, AddonDefinition } from '../core/config.ts';
import type { AddonOptions, OptionValues } from '../core/options.ts';
import aiTools, { type AiToolsOptions } from './ai-tools.ts';
import betterAuth, { type BetterAuthOptions } from './better-auth.ts';
import drizzle, { type DrizzleOptions } from './drizzle.ts';
import enhancedImg from './enhanced-img.ts';
import eslint from './eslint.ts';
import experimental, { type ExperimentalOptions } from './experimental.ts';
import mdsvex from './mdsvex.ts';
import paraglide, { type ParaglideOptions } from './paraglide.ts';
import playwright from './playwright.ts';
import prettier from './prettier.ts';
import storybook from './storybook.ts';
import sveltekitAdapter, { type SveltekitAdapterOptions } from './sveltekit-adapter.ts';
import tailwindcss, { type TailwindcssOptions } from './tailwindcss.ts';
import vitest, { type VitestOptions } from './vitest-addon.ts';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- an add-on without options has no values
type NoOptions = {};

/**
 * Each add-on declares the values of its own options; this table only wires them to an id.
 * The assignment below is what keeps it honest - no drift test needed.
 */
export type OfficialAddons = {
	prettier: Addon<NoOptions, 'prettier'>;
	eslint: Addon<NoOptions, 'eslint'>;
	vitest: Addon<AddonOptions<VitestOptions>, 'vitest'>;
	playwright: Addon<NoOptions, 'playwright'>;
	tailwindcss: Addon<AddonOptions<TailwindcssOptions>, 'tailwindcss'>;
	enhancedImg: Addon<NoOptions, 'enhanced-img'>;
	sveltekitAdapter: Addon<AddonOptions<SveltekitAdapterOptions>, 'sveltekit-adapter'>;
	drizzle: Addon<AddonOptions<DrizzleOptions>, 'drizzle'>;
	betterAuth: Addon<AddonOptions<BetterAuthOptions>, 'better-auth'>;
	mdsvex: Addon<NoOptions, 'mdsvex'>;
	paraglide: Addon<AddonOptions<ParaglideOptions>, 'paraglide'>;
	storybook: Addon<NoOptions, 'storybook'>;
	aiTools: Addon<AddonOptions<AiToolsOptions>, 'ai-tools'>;
	experimental: Addon<AddonOptions<ExperimentalOptions>, 'experimental'>;
};

/** Option values of every official add-on, keyed like {@link officialAddons}. */
export type OfficialAddonOptions = {
	[K in keyof OfficialAddons]: OptionValues<OfficialAddons[K]['options']>;
};

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
export const officialAddons: OfficialAddons = {
	prettier,
	eslint,
	vitest,
	playwright,
	tailwindcss,
	enhancedImg,
	sveltekitAdapter,
	drizzle,
	betterAuth,
	mdsvex,
	paraglide,
	storybook,
	aiTools,
	experimental
};

export function getAddonDetails(id: string): AddonDefinition {
	const details = Object.values(officialAddons).find((a) => a.id === id);
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details as AddonDefinition;
}
