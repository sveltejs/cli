import { defineAddon } from '@sveltejs/cli-core';
import { array, functions, imports, object, exports } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'vite-plugin-devtools-json',
	alias: 'devtools-json',
	shortDescription: 'Generate DevTools project settings in the devserver',
	homepage: 'https://github.com/ChromeDevTools/vite-plugin-devtools-json',
	options: {},

	setup: ({ vite, unsupported }) => {
		if (!vite) unsupported('Requires vite');
	},

	run: ({ sv, typescript, kit }) => {
		const ext = typescript ? 'ts' : 'js';
		if (!kit) throw new Error('SvelteKit is required');

		sv.dependency('vite-plugin-devtools-json', '^0.1.1');

		// add the vite plugin
		sv.file(`vite.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'devtoolsJson';
			imports.addDefault(ast, 'vite-plugin-devtools-json', vitePluginName);

			const { value: rootObject } = exports.defaultExport(ast, functions.call('defineConfig', []));
			const param1 = functions.argumentByIndex(rootObject, 0, object.createEmpty());

			const pluginsArray = object.property(param1, 'plugins', array.createEmpty());
			const pluginFunctionCall = functions.call(vitePluginName, []);
			// const pluginConfig = object.create({});
			// functions.argumentByIndex(pluginFunctionCall, 0, pluginConfig);
			array.push(pluginsArray, pluginFunctionCall);

			return generateCode();
		});
	}
});
