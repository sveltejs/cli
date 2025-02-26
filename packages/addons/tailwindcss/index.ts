import { defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { array, functions, imports, object, exports } from '@sveltejs/cli-core/js';
import { parseCss, parseJson, parseScript, parseSvelte } from '@sveltejs/cli-core/parsers';
import { addSlot } from '@sveltejs/cli-core/html';

type Plugin = {
	id: string;
	package: string;
	version: string;
	identifier: string;
};

const plugins: Plugin[] = [
	{
		id: 'typography',
		package: '@tailwindcss/typography',
		version: '^0.5.15',
		identifier: 'typography'
	},
	{
		id: 'forms',
		package: '@tailwindcss/forms',
		version: '^0.5.9',
		identifier: 'forms'
	}
];

const options = defineAddonOptions({
	plugins: {
		type: 'multiselect',
		question: 'Which plugins would you like to add?',
		options: plugins.map((p) => ({ value: p.id, label: p.id, hint: p.package })),
		default: []
	}
});

export default defineAddon({
	id: 'tailwindcss',
	alias: 'tailwind',
	shortDescription: 'css framework',
	homepage: 'https://tailwindcss.com',
	options,
	run: ({ sv, options, typescript, kit, dependencyVersion }) => {
		const ext = typescript ? 'ts' : 'js';
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('tailwindcss', '^4.0.0');
		sv.devDependency('@tailwindcss/vite', '^4.0.0');

		if (prettierInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.6.11');

		for (const plugin of plugins) {
			if (!options.plugins.includes(plugin.id)) continue;

			sv.devDependency(plugin.package, plugin.version);
		}

		// add the vite plugin
		sv.file(`vite.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'tailwindcss';
			imports.addDefault(ast, '@tailwindcss/vite', vitePluginName);

			const { value: rootObject } = exports.defaultExport(ast, functions.call('defineConfig', []));
			const param1 = functions.argumentByIndex(rootObject, 0, object.createEmpty());

			const pluginsArray = object.property(param1, 'plugins', array.createEmpty());
			const pluginFunctionCall = functions.call(vitePluginName, []);
			array.push(pluginsArray, pluginFunctionCall);

			return generateCode();
		});

		sv.file('src/app.css', (content) => {
			let code = content;

			const importsTailwind = content.match(/@import ["']tailwindcss["']/);
			if (!importsTailwind) {
				code = "@import 'tailwindcss';\n" + code;
			}

			const lastAtRule = code.match(/@(import|plugin).*[;]/gm)?.at(-1);
			if (!lastAtRule) throw new Error('Impossible condition: Missing `@import` atrule.');
			const pluginPos = code.indexOf(lastAtRule) + lastAtRule.length;

			const { ast } = parseCss(code);
			const atRules = ast.nodes.filter((x) => x.type === 'atrule');
			for (const plugin of plugins) {
				if (!options.plugins.includes(plugin.id)) continue;
				const atRule = atRules.find(
					(x) => x.name === 'plugin' && x.params === `'${plugin.package}'`
				);
				if (!atRule) {
					const pluginImport = `\n@plugin '${plugin.package}';`;
					code = code.substring(0, pluginPos) + pluginImport + code.substring(pluginPos);
				}
			}

			return code;
		});

		if (!kit) {
			sv.file('src/App.svelte', (content) => {
				const { script, generateCode } = parseSvelte(content, { typescript });
				imports.addEmpty(script.ast, './app.css');
				return generateCode({ script: script.generateCode() });
			});
		} else {
			sv.file(`${kit?.routesDirectory}/+layout.svelte`, (content) => {
				const { script, template, generateCode } = parseSvelte(content, { typescript });
				imports.addEmpty(script.ast, '../app.css');

				if (content.length === 0) {
					const svelteVersion = dependencyVersion('svelte');
					if (!svelteVersion) throw new Error('Failed to determine svelte version');
					addSlot(script.ast, template.ast, svelteVersion);
				}

				return generateCode({
					script: script.generateCode(),
					template: content.length === 0 ? template.generateCode() : undefined
				});
			});
		}

		if (dependencyVersion('prettier')) {
			sv.file('.prettierrc', (content) => {
				const { data, generateCode } = parseJson(content);
				const PLUGIN_NAME = 'prettier-plugin-tailwindcss';

				data.plugins ??= [];
				const plugins: string[] = data.plugins;

				if (!plugins.includes(PLUGIN_NAME)) plugins.push(PLUGIN_NAME);

				return generateCode();
			});
		}
	}
});
