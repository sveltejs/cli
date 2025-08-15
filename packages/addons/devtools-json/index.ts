import { defineAddon } from '@sveltejs/cli-core';
import { imports, vite } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'devtools-json',
	shortDescription: 'devtools json',
	homepage: 'https://github.com/ChromeDevTools/vite-plugin-devtools-json',
	options: {},

	run: ({ sv, viteConfigPath }) => {
		sv.devDependency('vite-plugin-devtools-json', '^1.0.0');

		// add the vite plugin
		sv.file(viteConfigPath, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'devtoolsJson';
			imports.addDefault(ast, { as: vitePluginName, from: 'vite-plugin-devtools-json' });
			vite.addPlugin(ast, { code: `${vitePluginName}()` });

			return generateCode();
		});
	}
});
