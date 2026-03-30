import { transforms } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';

export default defineAddon({
	id: 'devtools-json',
	shortDescription: 'devtools json',
	homepage: 'https://github.com/ChromeDevTools/vite-plugin-devtools-json',
	options: {},

	run: ({ sv, file }) => {
		sv.devDependency('vite-plugin-devtools-json', '^1.0.0');

		// add the vite plugin
		sv.file(
			file.viteConfig,
			transforms.script(({ ast, js }) => {
				const vitePluginName = 'devtoolsJson';
				js.imports.addDefault(ast, { as: vitePluginName, from: 'vite-plugin-devtools-json' });
				js.vite.addPlugin(ast, { code: `${vitePluginName}()` });
			})
		);
	}
});
