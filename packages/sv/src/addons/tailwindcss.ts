import { pnpm, transforms } from '@sveltejs/sv-utils';
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
	run: ({ sv, options, file, isKit, directory, dependencyVersion, language, packageManager }) => {
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('tailwindcss', '^4.2.2');
		sv.devDependency('@tailwindcss/vite', '^4.2.2');
		if (packageManager === 'pnpm') {
			sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds('@tailwindcss/oxide'));
		}

		if (prettierInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.7.2');

		for (const plugin of plugins) {
			if (!options.plugins.includes(plugin.id)) continue;

			sv.devDependency(plugin.package, plugin.version);
		}

		// add the vite plugin
		sv.file(
			file.viteConfig,
			transforms.script(({ ast, js }) => {
				const vitePluginName = 'tailwindcss';
				js.imports.addDefault(ast, { as: vitePluginName, from: '@tailwindcss/vite' });
				js.vite.addPlugin(ast, { code: `${vitePluginName}()`, mode: 'prepend' });
			})
		);

		sv.file(
			file.stylesheet,
			transforms.css(({ ast, css }) => {
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

		if (isKit) {
			const layoutSvelte = `${directory.kitRoutes}/+layout.svelte`;
			const stylesheetRelative = file.getRelative({ from: layoutSvelte, to: file.stylesheet });
			sv.file(
				layoutSvelte,
				transforms.svelteScript({ language }, ({ ast, svelte, js }) => {
					js.imports.addEmpty(ast.instance.content, { from: stylesheetRelative });

					if (ast.fragment.nodes.length === 0) {
						const svelteVersion = dependencyVersion('svelte');
						if (!svelteVersion) throw new Error('Failed to determine svelte version');
						svelte.addSlot(ast, { svelteVersion });
					}
				})
			);
		} else {
			const appSvelte = `${directory.src}/App.svelte`;
			const stylesheetRelative = file.getRelative({ from: appSvelte, to: file.stylesheet });
			sv.file(
				appSvelte,
				transforms.svelteScript({ language }, ({ ast, js }) => {
					js.imports.addEmpty(ast.instance.content, { from: stylesheetRelative });
				})
			);
		}

		sv.file(
			'.vscode/settings.json',
			transforms.json(({ data }) => {
				data['files.associations'] ??= {};
				data['files.associations']['*.css'] = 'tailwindcss';
			})
		);

		sv.file(
			'.vscode/extensions.json',
			transforms.json(({ data, json }) => {
				json.arrayUpsert(data, 'recommendations', 'bradlc.vscode-tailwindcss');
			})
		);

		if (prettierInstalled) {
			sv.file(
				'.prettierrc',
				transforms.json(({ data, json }) => {
					json.arrayUpsert(data, 'plugins', 'prettier-plugin-tailwindcss');
					data.tailwindStylesheet ??= file.getRelative({ to: file.stylesheet });
				})
			);
		}
	}
});
