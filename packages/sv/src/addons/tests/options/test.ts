import { expect, it } from 'vitest';
import type { OptionValues } from '../../../core/options.ts';
import type aiTools from '../../ai-tools.ts';
import type betterAuth from '../../better-auth.ts';
import type drizzle from '../../drizzle.ts';
import type enhancedImg from '../../enhanced-img.ts';
import type eslint from '../../eslint.ts';
import type experimental from '../../experimental.ts';
import type mdsvex from '../../mdsvex.ts';
import type { OfficialAddonOptions } from '../../options.ts';
import type paraglide from '../../paraglide.ts';
import type playwright from '../../playwright.ts';
import type prettier from '../../prettier.ts';
import type storybook from '../../storybook.ts';
import type sveltekitAdapter from '../../sveltekit-adapter.ts';
import type tailwindcss from '../../tailwindcss.ts';
import type vitest from '../../vitest-addon.ts';

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
	// published `.d.ts`; this fails to type-check (here and in `pnpm check`) as soon as the
	// two drift apart.
	const inSync: Equals<OfficialAddonOptions, Inferred> = true;

	expect(inSync).toBe(true);
});
