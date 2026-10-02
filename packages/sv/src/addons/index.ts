import type { Addon, AddonDefinition } from '../core/config.ts';
import type { OptionMap } from '../core/engine.ts';
import type { AddonOptions } from '../core/options.ts';
import type { OfficialAddonId } from './ids.ts';
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

// Each add-on declares its option values; `officialAddons` below fails to compile if one drifts.
export type OfficialAddons = {
	prettier: Addon<NoOptions, 'prettier'>;
	eslint: Addon<NoOptions, 'eslint'>;
	vitest: Addon<AddonOptions<VitestOptions>, 'vitest'>;
	playwright: Addon<NoOptions, 'playwright'>;
	tailwindcss: Addon<AddonOptions<TailwindcssOptions>, 'tailwindcss'>;
	'enhanced-img': Addon<NoOptions, 'enhanced-img'>;
	'sveltekit-adapter': Addon<AddonOptions<SveltekitAdapterOptions>, 'sveltekit-adapter'>;
	drizzle: Addon<AddonOptions<DrizzleOptions>, 'drizzle'>;
	'better-auth': Addon<AddonOptions<BetterAuthOptions>, 'better-auth'>;
	mdsvex: Addon<NoOptions, 'mdsvex'>;
	paraglide: Addon<AddonOptions<ParaglideOptions>, 'paraglide'>;
	storybook: Addon<NoOptions, 'storybook'>;
	'ai-tools': Addon<AddonOptions<AiToolsOptions>, 'ai-tools'>;
	experimental: Addon<AddonOptions<ExperimentalOptions>, 'experimental'>;
};

export type { OfficialAddonId };

/** What `add()` accepts as `options` for official add-ons, keyed by add-on id. */
export type OfficialAddonOptions = OptionMap<OfficialAddons>;

// The order of addons here determines the order they are displayed inside the CLI
// We generally try to order them by perceived popularity
export const officialAddons: OfficialAddons = {
	[prettier.id]: prettier,
	[eslint.id]: eslint,
	[vitest.id]: vitest,
	[playwright.id]: playwright,
	[tailwindcss.id]: tailwindcss,
	[enhancedImg.id]: enhancedImg,
	[sveltekitAdapter.id]: sveltekitAdapter,
	[drizzle.id]: drizzle,
	[betterAuth.id]: betterAuth,
	[mdsvex.id]: mdsvex,
	[paraglide.id]: paraglide,
	[storybook.id]: storybook,
	[aiTools.id]: aiTools,
	[experimental.id]: experimental
};

export function getAddonDetails(id: string): AddonDefinition {
	const details = officialAddons[id as OfficialAddonId];
	if (!details) {
		throw new Error(`Invalid add-on: ${id}`);
	}

	return details as AddonDefinition;
}
