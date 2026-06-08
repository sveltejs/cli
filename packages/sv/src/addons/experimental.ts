import { isVersionUnsupportedBelow, loadPackageJson, svelteConfig } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';

// Single source of truth, keyed by flag name. `path` defaults to `experimental.<name>`; `off` opts out
// of the default selection; `inNext: false` marks flags removed in kit 3 (skipped when `kit@next` is chosen).
type Feature = { label: string; path?: string; hint?: string; off?: boolean; inNext?: boolean };
const FEATURES: Record<string, Feature> = {
	async: { label: 'async', hint: 'await in components', path: 'compilerOptions.experimental.async' }, // prettier-ignore
	remoteFunctions: { label: 'remote functions' },
	explicitEnvironmentVariables: { label: 'explicit environment variables', hint: 'kit ^2 only', inNext: false }, // prettier-ignore
	handleRenderingErrors: { label: 'rendering error boundaries' },
	forkPreloads: { label: 'forked preloading', off: true }
};

// kit 3 raises these peer floors; bump only when the project is below them (never downgrade).
const KIT3_PEERS = {
	vite: '^8.0.0',
	'@sveltejs/vite-plugin-svelte': '^7.0.0',
	svelte: '^5.48.0',
	typescript: '^6.0.0' // TS projects only
};

const options = defineAddonOptions()
	.add('versions', {
		question: 'Which packages should use their `next` (pre-release) version?',
		type: 'multiselect',
		default: ['kit'],
		options: [{ value: 'kit', label: '@sveltejs/kit@next' }],
		required: false
	})
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

	setup: ({ runsAfter }) => runsAfter('sveltekitAdapter'),

	run: ({ sv, cwd, options, language, dependencyVersion }) => {
		const kitNext = options.versions.includes('kit');

		if (kitNext) {
			sv.devDependency('@sveltejs/kit', 'next');
			for (const [pkg, range] of Object.entries(KIT3_PEERS)) {
				if (pkg === 'typescript' && language !== 'ts') continue;
				const current = dependencyVersion(pkg);
				if (current && isVersionUnsupportedBelow(current, range)) sv.devDependency(pkg, range);
			}
			// adapters track kit's major, so move any installed `@sveltejs/adapter-*` to its `next` line too
			const { data: pkg } = loadPackageJson(cwd);
			const deps = { ...pkg.devDependencies, ...pkg.dependencies };
			for (const name of Object.keys(deps)) {
				if (name.startsWith('@sveltejs/adapter-')) sv.devDependency(name, 'next');
			}
		}

		const config: Record<string, any> = {};
		for (const [name, f] of Object.entries(FEATURES)) {
			if (!options.features.includes(name)) continue;
			if (kitNext && f.inNext === false) continue;
			const keys = (f.path ?? `experimental.${name}`).split('.');
			let target = config;
			for (const key of keys.slice(0, -1)) target = target[key] ??= {};
			target[keys.at(-1)!] = true;
		}

		if (Object.keys(config).length)
			svelteConfig.edit({ sv, cwd }, ({ override }) => override(config));
	}
});
