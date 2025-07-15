import { defineAddon } from '@sveltejs/cli-core';
import { imports } from '@sveltejs/cli-core/js';
import { addInArrayOfObject, addPluginToViteConfig } from '../../core/tooling/helpers.ts';

export default defineAddon({
	id: 'devtools-json',
	shortDescription: 'devtools json',
	homepage: 'https://github.com/ChromeDevTools/vite-plugin-devtools-json',
	options: {},

	run: ({ sv, typescript }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.devDependency('vite-plugin-devtools-json', '^0.2.0');

		// add the vite plugin
		sv.file(`vite.config.${ext}`, (content) => {
			return addPluginToViteConfig(content, (ast, configObject) => {
				const vitePluginName = 'devtoolsJson';
				imports.addDefault(ast, { from: 'vite-plugin-devtools-json', as: vitePluginName });
				addInArrayOfObject(configObject, {
					array: 'plugins',
					code: `${vitePluginName}()`
				});
			});
		});
	}
});
