import { color, transforms } from '@sveltejs/sv-utils';
import { type Addon, defineAddon, defineAddonOptions } from '../core/config.ts';
import type { AddonOptions } from '../core/options.ts';
import { ADDON_IDS } from './ids.ts';

export const plugins = [
	{ id: 'rolldown', preselected: true, package: '@vitejs/devtools-rolldown', version: '^0.8.3' },
	{ id: 'vite', preselected: true, package: '@vitejs/devtools-vite', version: '^0.8.3' },
	{ id: 'vitest', preselected: true, package: '@vitejs/devtools-vitest', version: '^0.8.3' },
	{ id: 'oxc', preselected: false, package: '@vitejs/devtools-oxc', version: '^0.8.3' }
] as const;

export type DevtoolsOptions = { plugins: Array<(typeof plugins)[number]['id']> };

const options = defineAddonOptions<DevtoolsOptions>()
	.add('plugins', {
		type: 'multiselect',
		question: 'Which other DevTool plugins would you like to add?',
		options: plugins.map((plugin) => ({
			value: plugin.id,
			label: plugin.id,
			hint: plugin.package
		})),
		default: plugins.filter((plugin) => plugin.preselected).map((plugin) => plugin.id),
		required: false
	})
	.build();

const addon: Addon<AddonOptions<DevtoolsOptions>, 'devtools'> = defineAddon({
	id: ADDON_IDS.devtools,
	name: 'DevTools',
	shortDescription: 'Vite and Svelte development tools',
	homepage: 'https://github.com/sveltejs/vite-devtools-svelte',
	options,
	setup: ({ runsAfter }) => {
		runsAfter(ADDON_IDS.vitest);
	},
	run: ({ sv, file, options }) => {
		sv.devDependency('@vitejs/devtools', '^0.8.3');
		sv.devDependency('@sveltejs/vite-devtools-svelte', '^0.11.0');
		for (const plugin of plugins.filter((p) => options.plugins.includes(p.id))) {
			sv.devDependency(plugin.package, plugin.version);
		}

		sv.file(
			file.viteConfig,
			transforms.script(({ ast, js }) => {
				js.object.overrideProperties(js.vite.getConfig(ast), {
					devtools: {
						apply: 'serve',
						clientAuth: true
					}
				});
				js.imports.addNamed(ast, {
					imports: ['svelteDevtools'],
					from: '@sveltejs/vite-devtools-svelte'
				});

				// The Svelte instrumentation must run before the Svelte plugin.
				js.vite.addPlugin(ast, { code: 'svelteDevtools()', mode: 'prepend' });
			})
		);
	},
	nextSteps: () => [
		`Start the development server and open the ${color.command('Vite DevTools')} dock`,
		`Docs: ${color.website('https://devtools.vite.dev')} and ${color.website(
			'https://github.com/sveltejs/vite-devtools-svelte'
		)}`
	]
});

export default addon;
