import { css, defineAddon, defineAddonOptions, js, parse, svelte } from '../../core.ts';

const plugins = /** @type {const} */ ([
	{
		id: 'typography',
		package: '@tailwindcss/typography',
		version: '^0.5.19'
	},
	{
		id: 'forms',
		package: '@tailwindcss/forms',
		version: '^0.5.10'
	}
]);

const options = defineAddonOptions()
	.add('plugins', {
		type: 'multiselect',
		question: 'Which plugins would you like to add?',
		options: plugins.map((p) => ({ value: p.id, label: p.id, hint: p.package })),
		/** @type {Array<(typeof plugins)[number]['id']>} */
		default: [],
		required: false
	})
	.build();

export default defineAddon({
	id: 'tailwindcss',
	alias: 'tailwind',
	shortDescription: 'css framework',
	homepage: 'https://tailwindcss.com',
	options,
	run: ({ sv, options, files, kit, dependencyVersion, typescript }) => {
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('tailwindcss', '^4.1.17');
		sv.devDependency('@tailwindcss/vite', '^4.1.17');
		sv.pnpmBuildDependency('@tailwindcss/oxide');

		if (prettierInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.7.2');

		for (const plugin of plugins) {
			if (!options.plugins.includes(plugin.id)) continue;

			sv.devDependency(plugin.package, plugin.version);
		}

		// add the vite plugin
		sv.file(files.viteConfig, (content) => {
			const { ast, generateCode } = parse.script(content);

			const vitePluginName = 'tailwindcss';
			js.imports.addDefault(ast, { as: vitePluginName, from: '@tailwindcss/vite' });
			js.vite.addPlugin(ast, { code: `${vitePluginName}()`, mode: 'prepend' });

			return generateCode();
		});

		sv.file(files.stylesheet, (content) => {
			const { ast, generateCode } = parse.css(content);

			// since we are prepending all the `AtRule` let's add them in reverse order,
			// so they appear in the expected order in the final file

			for (const plugin of plugins) {
				if (!options.plugins.includes(plugin.id)) continue;

				css.addAtRule(ast, {
					name: 'plugin',
					params: `'${plugin.package}'`,
					append: false
				});
			}

			css.addAtRule(ast, {
				name: 'import',
				params: `'tailwindcss'`,
				append: false
			});

			return generateCode();
		});

		if (!kit) {
			const appSvelte = 'src/App.svelte';
			const stylesheetRelative = files.getRelative({ from: appSvelte, to: files.stylesheet });
			sv.file(appSvelte, (content) => {
				const { ast, generateCode } = parse.svelte(content);
				svelte.ensureScript(ast, { langTs: typescript });
				js.imports.addEmpty(ast.instance.content, { from: stylesheetRelative });
				return generateCode();
			});
		} else {
			const layoutSvelte = `${kit?.routesDirectory}/+layout.svelte`;
			const stylesheetRelative = files.getRelative({ from: layoutSvelte, to: files.stylesheet });
			sv.file(layoutSvelte, (content) => {
				const { ast, generateCode } = parse.svelte(content);
				svelte.ensureScript(ast, { langTs: typescript });
				js.imports.addEmpty(ast.instance.content, { from: stylesheetRelative });

				if (content.length === 0) {
					const svelteVersion = dependencyVersion('svelte');
					if (!svelteVersion) throw new Error('Failed to determine svelte version');
					svelte.addSlot(ast, {
						svelteVersion
					});
				}

				return generateCode();
			});
		}

		sv.file(files.vscodeSettings, (content) => {
			const { data, generateCode } = parse.json(content);

			data['files.associations'] ??= {};
			data['files.associations']['*.css'] = 'tailwindcss';

			return generateCode();
		});

		if (prettierInstalled) {
			sv.file(files.prettierrc, (content) => {
				const { data, generateCode } = parse.json(content);

				data.plugins ??= [];
				/** @type {string[]} */
				const plugins = data.plugins;
				const PLUGIN_NAME = 'prettier-plugin-tailwindcss';
				if (!plugins.includes(PLUGIN_NAME)) plugins.push(PLUGIN_NAME);
				data.tailwindStylesheet ??= files.getRelative({ to: files.stylesheet });

				return generateCode();
			});
		}
	}
});
