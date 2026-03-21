import { css, js, transforms, svelte, json } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';

const plugins = [
	{
		id: 'typography',
		package: '@tailwindcss/typography',
		version: '^0.5.19'
	},
	{
		id: 'forms',
		package: '@tailwindcss/forms',
		version: '^0.5.11'
	}
] as const;

const options = defineAddonOptions()
	.add('plugins', {
		type: 'multiselect',
		question: 'Which plugins would you like to add?',
		options: plugins.map((p) => ({ value: p.id, label: p.id, hint: p.package })),
		default: [] as Array<(typeof plugins)[number]['id']>,
		required: false
	})
	.build();

export default defineAddon({
	id: 'tailwindcss',
	alias: 'tailwind',
	shortDescription: 'css framework',
	homepage: 'https://tailwindcss.com',
	options,
	run: ({ sv, options, files, kit, dependencyVersion }) => {
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('tailwindcss', '^4.1.18');
		sv.devDependency('@tailwindcss/vite', '^4.1.18');
		sv.pnpmBuildDependency('@tailwindcss/oxide');

		if (prettierInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.7.2');

		for (const plugin of plugins) {
			if (!options.plugins.includes(plugin.id)) continue;

			sv.devDependency(plugin.package, plugin.version);
		}

		// add the vite plugin
		sv.file(
			files.viteConfig,
			transforms.script((ast) => {
				const vitePluginName = 'tailwindcss';
				js.imports.addDefault(ast, { as: vitePluginName, from: '@tailwindcss/vite' });
				js.vite.addPlugin(ast, { code: `${vitePluginName}()`, mode: 'prepend' });
			})
		);

		sv.file(
			files.stylesheet,
			transforms.css((ast) => {
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
			})
		);

		if (!kit) {
			const appSvelte = 'src/App.svelte';
			const stylesheetRelative = files.getRelative({ from: appSvelte, to: files.stylesheet });
			sv.file(
				appSvelte,
				transforms.svelte((ast, { language }) => {
					svelte.ensureScript(ast, { language });
					js.imports.addEmpty(ast.instance.content, { from: stylesheetRelative });
				})
			);
		} else {
			const layoutSvelte = `${kit?.routesDirectory}/+layout.svelte`;
			const stylesheetRelative = files.getRelative({ from: layoutSvelte, to: files.stylesheet });
			sv.file(
				layoutSvelte,
				transforms.svelte((ast, { language }) => {
					svelte.ensureScript(ast, { language });
					js.imports.addEmpty(ast.instance.content, { from: stylesheetRelative });

					if (ast.fragment.nodes.length === 0) {
						const svelteVersion = dependencyVersion('svelte');
						if (!svelteVersion) throw new Error('Failed to determine svelte version');
						svelte.addSlot(ast, {
							svelteVersion
						});
					}
				})
			);
		}

		sv.file(
			files.vscodeSettings,
			transforms.json((data) => {
				data['files.associations'] ??= {};
				data['files.associations']['*.css'] = 'tailwindcss';
			})
		);

		sv.file(
			files.vscodeExtensions,
			transforms.json((data) => {
				json.arrayUpsert(data, 'recommendations', 'bradlc.vscode-tailwindcss');
			})
		);

		if (prettierInstalled) {
			sv.file(
				files.prettierrc,
				transforms.json((data) => {
					json.arrayUpsert(data, 'plugins', 'prettier-plugin-tailwindcss');
					data.tailwindStylesheet ??= files.getRelative({ to: files.stylesheet });
				})
			);
		}
	}
});
