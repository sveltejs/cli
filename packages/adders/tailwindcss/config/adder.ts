import { options } from './options.ts';
import { defineAdderConfig } from '@svelte-cli/core';
import { array, common, functions, imports, object } from '@svelte-cli/core/js';
import { addImports } from '@svelte-cli/core/css';
import { element } from '@svelte-cli/core/html';

export const adder = defineAdderConfig({
	metadata: {
		id: 'tailwindcss',
		alias: 'tailwind',
		name: 'Tailwind CSS',
		description: 'Rapidly build modern websites without ever leaving your HTML',
		environments: { svelte: true, kit: true },
		website: {
			logo: './tailwindcss.svg',
			keywords: ['tailwind', 'postcss', 'autoprefixer'],
			documentation: 'https://tailwindcss.com/docs'
		}
	},
	options,
	integrationType: 'inline',
	packages: [
		{ name: 'tailwindcss', version: '^3.4.9', dev: true },
		{ name: 'autoprefixer', version: '^10.4.20', dev: true },
		{
			name: '@tailwindcss/typography',
			version: '^0.5.14',
			dev: true,
			condition: ({ options }) => options.plugins.includes('typography')
		},
		{
			name: 'prettier-plugin-tailwindcss',
			version: '^0.6.5',
			dev: true,
			condition: ({ prettier }) => prettier
		}
	],
	files: [
		{
			name: ({ typescript }) => `tailwind.config.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			content: ({ options, ast, typescript }) => {
				let root;
				const rootExport = object.createEmpty();
				if (typescript) {
					imports.addNamed(ast, 'tailwindcss', { Config: 'Config' }, true);
					root = common.typeAnnotateExpression(rootExport, 'Config');
				}

				const { astNode: exportDeclaration } = exports.defaultExport(ast, root ?? rootExport);

				if (!typescript)
					common.addJsDocTypeComment(exportDeclaration, "import('tailwindcss').Config");

				const contentArray = object.property(rootExport, 'content', array.createEmpty());
				array.push(contentArray, './src/**/*.{html,js,svelte,ts}');

				const themeObject = object.property(rootExport, 'theme', object.createEmpty());
				object.property(themeObject, 'extend', object.createEmpty());

				const pluginsArray = object.property(rootExport, 'plugins', array.createEmpty());

				if (options.plugins.includes('typography')) {
					const requireCall = functions.call('require', ['@tailwindcss/typography']);
					array.push(pluginsArray, requireCall);
				}
			}
		},
		{
			name: () => 'postcss.config.js',
			contentType: 'script',
			content: ({ ast }) => {
				const { value: rootObject } = exports.defaultExport(ast, object.createEmpty());
				const pluginsObject = object.property(rootObject, 'plugins', object.createEmpty());

				object.property(pluginsObject, 'tailwindcss', object.createEmpty());
				object.property(pluginsObject, 'autoprefixer', object.createEmpty());
			}
		},
		{
			name: () => 'src/app.css',
			contentType: 'css',
			content: ({ ast }) => {
				const layerImports = ['base', 'components', 'utilities'].map(
					(layer) => `"tailwindcss/${layer}"`
				);
				const originalFirst = ast.first;

				const nodes = addImports(ast, layerImports);

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
			}
		},
		{
			name: () => 'src/App.svelte',
			contentType: 'svelte',
			content: ({ jsAst }) => {
				imports.addEmpty(jsAst, './app.css');
			},
			condition: ({ kit }) => !kit
		},
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+layout.svelte`,
			contentType: 'svelte',
			content: ({ jsAst, htmlAst }) => {
				imports.addEmpty(jsAst, '../app.css');
				if (htmlAst.childNodes.length === 0) {
					const slot = element('slot');
					htmlAst.childNodes.push(slot);
				}
			},
			condition: ({ kit }) => Boolean(kit)
		},
		{
			name: () => '.prettierrc',
			contentType: 'json',
			content: ({ data }) => {
				const PLUGIN_NAME = 'prettier-plugin-tailwindcss';

				data.plugins ??= [];
				const plugins: string[] = data.plugins;

				if (!plugins.includes(PLUGIN_NAME)) plugins.push(PLUGIN_NAME);
			},
			condition: ({ prettier }) => prettier
		}
	]
});
