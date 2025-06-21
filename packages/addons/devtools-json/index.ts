import { defineAddon } from '@sveltejs/cli-core';
import { array, functions, imports, object, exports } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'devtools-json',
	shortDescription: 'devtools json',
	homepage: 'https://github.com/ChromeDevTools/vite-plugin-devtools-json',
	options: {},

	setup: ({ defaultSelection }) => {
		defaultSelection({
			create: true,
			add: false
		});
	},

	run: ({ sv, typescript }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.devDependency('vite-plugin-devtools-json', '^0.2.0');

		// add the vite plugin
		sv.file(`vite.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'devtoolsJson';
			imports.addDefault(ast, { from: 'vite-plugin-devtools-json', as: vitePluginName });

			const { value: rootObject } = exports.createDefault(ast, {
				fallback: functions.createCall({ name: 'defineConfig', args: [] })
			});

			const param1 = functions.getArgument(rootObject, {
				index: 0,
				fallback: object.create({})
			});

			const pluginsArray = object.property(param1, { name: 'plugins', fallback: array.create() });
			const pluginFunctionCall = functions.createCall({ name: vitePluginName, args: [] });

			array.append(pluginsArray, pluginFunctionCall);

			return generateCode();
		});
	}
});
