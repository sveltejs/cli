import { defineAddon } from '../../core.ts';
import { imports, vite } from '../../core/tooling/js/index.ts';
import { parseScript } from '../../core/tooling/parsers.ts';

export default defineAddon({
	id: 'devtools-json',
	shortDescription: 'devtools json',
	homepage: 'https://github.com/ChromeDevTools/vite-plugin-devtools-json',
	options: {},

	run: ({ sv, files }) => {
		sv.devDependency('vite-plugin-devtools-json', '^1.0.0');

		// add the vite plugin
		sv.file(files.viteConfig, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'devtoolsJson';
			imports.addDefault(ast, { as: vitePluginName, from: 'vite-plugin-devtools-json' });
			vite.addPlugin(ast, { code: `${vitePluginName}()` });

			return generateCode();
		});
	}
});
