import { color, transforms } from '@sveltejs/sv-utils';
import { type Addon, defineAddon, defineAddonOptions } from '../core/config.ts';
import type { AddonOptions } from '../core/options.ts';
import { ADDON_IDS } from './ids.ts';

const plugins = ['vitest', 'oxc', 'rolldown', 'vite'] as const;

export type DevtoolsOptions = { plugins: Array<'vitest' | 'oxc' | 'rolldown' | 'vite'> };

const options = defineAddonOptions<DevtoolsOptions>()
	.add('plugins', {
		type: 'multiselect',
		question: 'Which Vite DevTools plugins would you like to add?',
		options: plugins.map((plugin) => ({
			value: plugin,
			label: plugin,
			hint: `@vitejs/devtools-${plugin}`
		})),
		default: plugins.filter((plugin) => plugin !== 'oxc'),
		required: false
	})
	.build();

const addon: Addon<AddonOptions<DevtoolsOptions>, 'devtools'> = defineAddon({
	id: ADDON_IDS.devtools,
	shortDescription: 'Vite and Svelte development tools',
	homepage: 'https://github.com/sveltejs/vite-devtools-svelte',
	options,
	setup: ({ runsAfter }) => {
		runsAfter(ADDON_IDS.vitest);
	},
	run: ({ sv, file, options }) => {
		sv.devDependency('@vitejs/devtools', '^0.8.3');
		sv.devDependency('@sveltejs/vite-devtools-svelte', '^0.8.0');
		for (const plugin of options.plugins) {
			sv.devDependency(`@vitejs/devtools-${plugin}`, '^0.8.3');
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
			'https://github.com/baseballyama/vite-devtools-svelte'
		)}`
	]
});

export default addon;
