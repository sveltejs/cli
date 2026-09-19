import { expect, it } from 'vitest';
import type aiTools from '../../addons/ai-tools.ts';
import type betterAuth from '../../addons/better-auth.ts';
import type drizzle from '../../addons/drizzle.ts';
import type enhancedImg from '../../addons/enhanced-img.ts';
import type eslint from '../../addons/eslint.ts';
import type experimental from '../../addons/experimental.ts';
import type mdsvex from '../../addons/mdsvex.ts';
import type { OfficialAddonOptions } from '../../addons/options.ts';
import type paraglide from '../../addons/paraglide.ts';
import type playwright from '../../addons/playwright.ts';
import type prettier from '../../addons/prettier.ts';
import type storybook from '../../addons/storybook.ts';
import type sveltekitAdapter from '../../addons/sveltekit-adapter.ts';
import type tailwindcss from '../../addons/tailwindcss.ts';
import type vitest from '../../addons/vitest-addon.ts';
import type { OptionValues } from '../options.ts';

type Inferred = {
	prettier: OptionValues<typeof prettier.options>;
	eslint: OptionValues<typeof eslint.options>;
	vitest: OptionValues<typeof vitest.options>;
	playwright: OptionValues<typeof playwright.options>;
	tailwindcss: OptionValues<typeof tailwindcss.options>;
	enhancedImg: OptionValues<typeof enhancedImg.options>;
	sveltekitAdapter: OptionValues<typeof sveltekitAdapter.options>;
	drizzle: OptionValues<typeof drizzle.options>;
	betterAuth: OptionValues<typeof betterAuth.options>;
	mdsvex: OptionValues<typeof mdsvex.options>;
	paraglide: OptionValues<typeof paraglide.options>;
	storybook: OptionValues<typeof storybook.options>;
	aiTools: OptionValues<typeof aiTools.options>;
	experimental: OptionValues<typeof experimental.options>;
};

type Equals<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: 'OfficialAddonOptions no longer matches the add-on option definitions';

it('OfficialAddonOptions matches the option definitions of every official add-on', () => {
	// `OfficialAddonOptions` is hand-written to keep the add-on option literals out of the
	// published `.d.ts`; this fails to type-check as soon as the two drift apart.
	const inSync: Equals<OfficialAddonOptions, Inferred> = true;

	expect(inSync).toBe(true);
});
