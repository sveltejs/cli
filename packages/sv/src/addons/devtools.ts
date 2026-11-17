import { color, transforms } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';
import { ADDON_IDS } from './ids.ts';

export default defineAddon({
	id: ADDON_IDS.devtools,
	shortDescription: 'Vite and Svelte development tools',
	homepage: 'https://devtools.vite.dev',
	options: {},
	setup: ({ runsAfter }) => {
		runsAfter(ADDON_IDS.vitest);
	},
	run: ({ sv, file, dependencyVersion }) => {
		sv.devDependency('@vitejs/devtools', '^0.8.3');
		sv.devDependency('@vitejs/devtools-vite', '^0.8.3');
		sv.devDependency('vite-devtools-svelte', '^0.7.0');
		if (dependencyVersion('vitest')) {
			sv.devDependency('@vitejs/devtools-vitest', '^0.8.3');
		}

		sv.file(
			file.viteConfig,
			transforms.script(({ ast, js }) => {
				js.object.overrideProperties(js.vite.getConfig(ast), {
					devtools: {
						apply: 'serve'
					}
				});
				js.imports.addNamed(ast, {
					imports: ['svelteDevtools'],
					from: 'vite-devtools-svelte'
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
