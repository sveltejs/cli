import { defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { imports, vite } from '@sveltejs/cli-core/js';
import { parseCss, parseJson, parseScript, parseSvelte } from '@sveltejs/cli-core/parsers';
import { addSlot } from '@sveltejs/cli-core/html';

function typedEntries<T extends Record<string, any>>(obj: T): Array<[keyof T, T[keyof T]]> {
	return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}

const plugins = {
	typography: {
		package: '@tailwindcss/typography',
		version: '^0.5.15'
	},
	forms: {
		package: '@tailwindcss/forms',
		version: '^0.5.9'
	}
} as const;

const options = defineAddonOptions()
	.add('plugins', {
		type: 'multiselect',
		question: 'Which plugins would you like to add?',
		options: typedEntries(plugins).map(([id, p]) => ({ value: id, label: id, hint: p.package })),
		default: [] as Array<keyof typeof plugins>,
		required: false
	})
	.build();

export default defineAddon({
	id: 'tailwindcss',
	alias: 'tailwind',
	shortDescription: 'css framework',
	homepage: 'https://tailwindcss.com',
	options,
	run: ({ sv, options, viteConfigFile, typescript, kit, dependencyVersion }) => {
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('tailwindcss', '^4.0.0');
		sv.devDependency('@tailwindcss/vite', '^4.0.0');

		if (prettierInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.6.11');

		for (const [id, plugin] of typedEntries(plugins)) {
			if (!options.plugins.includes(id)) continue;

			sv.devDependency(plugin.package, plugin.version);
		}

		// add the vite plugin
		sv.file(viteConfigFile, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'tailwindcss';
			imports.addDefault(ast, { as: vitePluginName, from: '@tailwindcss/vite' });
			vite.addPlugin(ast, { code: `${vitePluginName}()`, mode: 'prepend' });

			return generateCode();
		});

		sv.file('src/app.css', (content) => {
			let atRules = parseCss(content).ast.nodes.filter((node) => node.type === 'atrule');

			const findAtRule = (name: string, params: string) =>
				atRules.find(
					(rule) =>
						rule.name === name &&
						// checks for both double and single quote variants
						rule.params.replace(/['"]/g, '') === params
				);

			let code = content;
			const importsTailwind = findAtRule('import', 'tailwindcss');
			if (!importsTailwind) {
				code = "@import 'tailwindcss';\n" + code;
				// reparse to account for the newly added tailwindcss import
				atRules = parseCss(code).ast.nodes.filter((node) => node.type === 'atrule');
			}

			const lastAtRule = atRules.findLast((rule) => ['plugin', 'import'].includes(rule.name));
			const pluginPos = lastAtRule!.source!.end!.offset;

			for (const [id, plugin] of typedEntries(plugins)) {
				if (!options.plugins.includes(id)) continue;

				const pluginRule = findAtRule('plugin', plugin.package);
				if (!pluginRule) {
					const pluginImport = `\n@plugin '${plugin.package}';`;
					code = code.substring(0, pluginPos) + pluginImport + code.substring(pluginPos);
				}
			}

			return code;
		});
		if (!kit) {
			sv.file('src/App.svelte', (content) => {
				const { script, generateCode } = parseSvelte(content, { typescript });
				imports.addEmpty(script.ast, { from: './app.css' });
				return generateCode({ script: script.generateCode() });
			});
		} else {
			sv.file(`${kit?.routesDirectory}/+layout.svelte`, (content) => {
				const { script, template, generateCode } = parseSvelte(content, { typescript });
				imports.addEmpty(script.ast, { from: '../app.css' });

				if (content.length === 0) {
					const svelteVersion = dependencyVersion('svelte');
					if (!svelteVersion) throw new Error('Failed to determine svelte version');
					addSlot(script.ast, {
						htmlAst: template.ast,
						svelteVersion
					});
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

				data.tailwindStylesheet ??= './src/app.css';

				return generateCode();
			});
		}
	}
});
