import { defineAddon, js, parse } from '../../core.ts';

export default defineAddon({
	id: 'devtools-json',
	shortDescription: 'devtools json',
	homepage: 'https://github.com/ChromeDevTools/vite-plugin-devtools-json',
	options: {},

	run: ({ sv, files }) => {
		sv.devDependency('vite-plugin-devtools-json', '^1.0.0');

		// add the vite plugin
		sv.file(files.viteConfig, (content) => {
			const { ast, generateCode } = parse.script(content);

			const vitePluginName = 'devtoolsJson';
			js.imports.addDefault(ast, { as: vitePluginName, from: 'vite-plugin-devtools-json' });
			js.vite.addPlugin(ast, { code: `${vitePluginName}()` });

			return generateCode();
		});
	}
});
