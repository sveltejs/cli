import { defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { addImports } from '@sveltejs/cli-core/css';
import { array, common, exports, imports, object } from '@sveltejs/cli-core/js';
import { parseCss, parseScript, parseJson, parseSvelte } from '@sveltejs/cli-core/parsers';
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
	},
	{
		id: 'container-queries',
		package: '@tailwindcss/container-queries',
		version: '^0.1.1',
		identifier: 'containerQueries'
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

		sv.devDependency('tailwindcss', '^3.4.16');
		sv.devDependency('autoprefixer', '^10.4.20');

		if (prettierInstalled) sv.devDependency('prettier-plugin-tailwindcss', '^0.6.9');

		for (const plugin of plugins) {
			if (!options.plugins.includes(plugin.id)) continue;

			sv.dependency(plugin.package, plugin.version);
		}

		sv.file(`tailwind.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);
			let root;
			const rootExport = object.createEmpty();
			if (typescript) {
				imports.addNamed(ast, 'tailwindcss', { Config: 'Config' }, true);
				root = common.satisfiesExpression(rootExport, 'Config');
			}

			const { astNode: exportDeclaration, value: node } = exports.defaultExport(
				ast,
				root ?? rootExport
			);

			const config = node.type === 'TSSatisfiesExpression' ? node.expression : node;
			if (config.type !== 'ObjectExpression') {
				throw new Error(`Unexpected tailwind config shape: ${config.type}`);
			}

			if (!typescript) {
				common.addJsDocTypeComment(exportDeclaration, "import('tailwindcss').Config");
			}

			const contentArray = object.property(config, 'content', array.createEmpty());
			array.push(contentArray, './src/**/*.{html,js,svelte,ts}');

			const themeObject = object.property(config, 'theme', object.createEmpty());
			object.property(themeObject, 'extend', object.createEmpty());

			const pluginsArray = object.property(config, 'plugins', array.createEmpty());

			for (const plugin of plugins) {
				if (!options.plugins.includes(plugin.id)) continue;
				imports.addDefault(ast, plugin.package, plugin.identifier);
				array.push(pluginsArray, { type: 'Identifier', name: plugin.identifier });
			}

			return generateCode();
		});

		sv.file('postcss.config.js', (content) => {
			const { ast, generateCode } = parseScript(content);
			const { value: rootObject } = exports.defaultExport(ast, object.createEmpty());
			const pluginsObject = object.property(rootObject, 'plugins', object.createEmpty());

			object.property(pluginsObject, 'tailwindcss', object.createEmpty());
			object.property(pluginsObject, 'autoprefixer', object.createEmpty());
			return generateCode();
		});

		sv.file('src/app.css', (content) => {
			const layerImports = ['base', 'components', 'utilities'].map(
				(layer) => `tailwindcss/${layer}`
			);
			if (layerImports.every((i) => content.includes(i))) {
				return content;
			}

			const { ast, generateCode } = parseCss(content);
			const originalFirst = ast.first;

			const specifiers = layerImports.map((i) => `'${i}'`);
			const nodes = addImports(ast, specifiers);

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
