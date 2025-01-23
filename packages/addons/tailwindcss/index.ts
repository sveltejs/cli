import { defineAddon } from '@sveltejs/cli-core';
import { addImports } from '@sveltejs/cli-core/css';
import {
	array,
	common,
	functions,
	imports,
	object,
	variables,
	exports
} from '@sveltejs/cli-core/js';
import { parseCss, parseJson, parseScript, parseSvelte } from '@sveltejs/cli-core/parsers';
import { addSlot } from '@sveltejs/cli-core/html';

export default defineAddon({
	id: 'tailwindcss',
	alias: 'tailwind',
	shortDescription: 'css framework',
	homepage: 'https://tailwindcss.com',
	options: {},
	run: ({ sv, typescript, kit, dependencyVersion }) => {
		const ext = typescript ? 'ts' : 'js';
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('tailwindcss', '^4.0.0');
		sv.devDependency('@tailwindcss/vite', '^4.0.0');

		if (prettierInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.6.11');

		// add the vite plugin
		sv.file(`vite.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			const vitePluginName = 'tailwindcss';
			imports.addNamed(ast, '@tailwindcss/vite', { tailwindcss: vitePluginName });

			const { value: rootObject } = exports.defaultExport(ast, functions.call('defineConfig', []));
			const param1 = functions.argumentByIndex(rootObject, 0, object.createEmpty());

			const pluginsArray = object.property(param1, 'plugins', array.createEmpty());
			const pluginFunctionCall = functions.call(vitePluginName, []);
			array.push(pluginsArray, pluginFunctionCall);

			return generateCode();
		});

		sv.file('src/app.css', (content) => {
			if (content.includes('tailwindcss')) {
				return content;
			}

			const { ast, generateCode } = parseCss(content);
			const originalFirst = ast.first;

			const nodes = addImports(ast, ["'tailwindcss'"]);

			if (
				originalFirst !== ast.first &&
				originalFirst?.type === 'atrule' &&
				originalFirst.name === 'import'
			) {
				originalFirst.raws.before = '\n';
			}

			// We remove the first node to avoid adding a newline at the top of the stylesheet
			nodes.shift();

			// Each node is prefixed with single newline, ensuring the imports will always be single spaced.
			// Without this, the CSS printer will vary the spacing depending on the current state of the stylesheet
			nodes.forEach((n) => (n.raws.before = '\n'));

			return generateCode();
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
