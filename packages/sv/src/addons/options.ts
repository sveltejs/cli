import type { Addon } from '../core/config.ts';
import type {
	BaseQuestion,
	BooleanQuestion,
	MultiSelectQuestion,
	NumberQuestion,
	OptionDefinition,
	SelectQuestion,
	StringQuestion
} from '../core/options.ts';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- an add-on without options has no values
type NoOptions = {};

/** The question that produces a given option value. `[…]` pairs keep unions from distributing. */
type QuestionFor<Value> = BaseQuestion<any> &
	([Value] extends [boolean]
		? BooleanQuestion
		: [Value] extends [number]
			? NumberQuestion
			: [Value] extends [Array<infer Item>]
				? MultiSelectQuestion<Item>
				: [string] extends [Value]
					? StringQuestion
					: SelectQuestion<Value>);

// `infer … extends` re-states the constraint TS can't verify through the mapped type.
type QuestionsFor<Values> = {
	[K in keyof Values]: QuestionFor<Values[K]>;
} extends infer Questions extends OptionDefinition
	? Questions
	: never;

/** Add-on ids, for the ones that differ from their key in `officialAddons`. */
type OfficialAddonIds = {
	enhancedImg: 'enhanced-img';
	sveltekitAdapter: 'sveltekit-adapter';
	betterAuth: 'better-auth';
	aiTools: 'ai-tools';
};

/** Shape of `officialAddons`, derived from the option values below. */
export type OfficialAddons = {
	[K in keyof OfficialAddonOptions]: Addon<
		QuestionsFor<OfficialAddonOptions[K]>,
		K extends keyof OfficialAddonIds ? OfficialAddonIds[K] : K & string
	>;
};

/**
 * Option values of every official add-on.
 *
 * Written by hand: inferring it from `officialAddons` would drag every add-on's option literals
 * into the published `.d.ts`. `core/tests/addon-options.ts` fails when the two drift apart.
 */
export type OfficialAddonOptions = {
	prettier: NoOptions;
	eslint: NoOptions;
	vitest: { usages: Array<'unit' | 'component'> };
	playwright: NoOptions;
	tailwindcss: { plugins: Array<'typography' | 'forms'> };
	enhancedImg: NoOptions;
	sveltekitAdapter: {
		adapter: 'auto' | 'node' | 'static' | 'vercel' | 'cloudflare' | 'netlify';
		cfTarget: 'workers' | 'pages';
	};
	drizzle: {
		database: 'postgresql' | 'mysql' | 'sqlite' | 'd1';
		postgresql: 'postgres.js' | 'neon';
		mysql: 'mysql2' | 'planetscale';
		sqlite: 'node-sqlite' | 'better-sqlite3' | 'libsql' | 'turso';
		docker: boolean;
	};
	betterAuth: { demo: Array<'password' | 'github'> };
	mdsvex: NoOptions;
	paraglide: { languageTags: string; demo: boolean };
	storybook: NoOptions;
	aiTools: {
		ide: string[];
		delivery: 'plugin' | 'tools';
		tools: string[];
		mcpSetup: 'local' | 'remote';
	};
	experimental: { features: string[] };
};
