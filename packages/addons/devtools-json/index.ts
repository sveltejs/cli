import { defineAddon } from '@sveltejs/cli-core';
import { array, functions, imports, object, exports } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';

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
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'devtoolsJson';
			imports.addDefault(ast, 'vite-plugin-devtools-json', vitePluginName);

			const { value: rootObject } = exports.defaultExport(ast, functions.call('defineConfig', []));
			const param1 = functions.argumentByIndex(rootObject, 0, object.createEmpty());

			const pluginsArray = object.property(param1, 'plugins', array.createEmpty());
			const pluginFunctionCall = functions.call(vitePluginName, []);
			array.push(pluginsArray, pluginFunctionCall);

			return generateCode();
		});
	}
});
