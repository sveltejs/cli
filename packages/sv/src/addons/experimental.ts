import { svelteConfig } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';

// Single source of truth, keyed by flag name. `path` defaults to `experimental.<name>` and `off`
// opts out of the default selection.
type Feature = { label: string; path?: string; hint?: string; off?: boolean };
const FEATURES: Record<string, Feature> = {
	async: { label: 'async', hint: 'await in components', path: 'compilerOptions.experimental.async' }, // prettier-ignore
	remoteFunctions: { label: 'remote functions' },
	forkPreloads: { label: 'forked preloading', off: true }
};

const options = defineAddonOptions()
	.add('features', {
		question: 'Which experimental features do you want to enable?',
		type: 'multiselect',
		default: Object.entries(FEATURES)
			.filter(([, f]) => !f.off)
			.map(([value]) => value),
		options: Object.entries(FEATURES).map(([value, { label, hint }]) => ({ value, label, hint })),
		required: false
	})
	.build();

export default defineAddon({
	id: 'experimental',
	shortDescription: 'svelte & kit experimental features',
	homepage: 'https://svelte.dev/docs/kit/configuration#experimental',
	options,
	run: ({ sv, cwd, options }) => {
		const config: Record<string, any> = {};
		for (const [name, f] of Object.entries(FEATURES)) {
			if (!options.features.includes(name)) continue;
			const keys = (f.path ?? `experimental.${name}`).split('.');
			let target = config;
			for (const key of keys.slice(0, -1)) target = target[key] ??= {};
			target[keys.at(-1)!] = true;
		}

		if (Object.keys(config).length)
			svelteConfig.edit({ sv, cwd }, ({ override }) => override(config));
	}
});
