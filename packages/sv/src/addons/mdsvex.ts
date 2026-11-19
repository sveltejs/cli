import { color, transforms } from '@sveltejs/sv-utils';
import { type Addon, defineAddon, defineAddonOptions } from '../core/config.ts';
import type { AddonOptions } from '../core/options.ts';
import { addPrettierMdsvex, prettierConfigPath } from './common.ts';
import { ADDON_IDS } from './ids.ts';

export type MdsvexPlugin =
	| 'callouts'
	| 'elements'
	| 'steps'
	| 'tabs'
	| 'emoji'
	| 'code-blocks'
	| 'diagram'
	| 'embeds'
	| 'figures'
	| 'anchors'
	| 'toc'
	| 'external-links'
	| 'references'
	| 'citations'
	| 'numbering'
	| 'page-data'
	| 'link-check';

const plugins = [
	{
		id: 'callouts',
		package: '@mdsvex/plugin-callouts',
		import: 'callouts',
		description: 'Notes, tips and warnings',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'elements',
		package: '@mdsvex/plugin-elements',
		import: 'elements',
		description: 'Details, keys, badges and more',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'steps',
		package: '@mdsvex/plugin-steps',
		import: 'steps',
		description: 'Numbered steps',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'tabs',
		package: '@mdsvex/plugin-tabs',
		import: 'tabs',
		description: 'Tabs and code groups',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'emoji',
		package: '@mdsvex/plugin-emoji',
		import: 'emoji',
		description: 'Emoji shortcodes',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'code-blocks',
		package: '@mdsvex/plugin-code-blocks',
		import: 'code_blocks',
		description: 'Code blocks with a copy button',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'diagram',
		package: '@mdsvex/plugin-diagram',
		import: 'diagram',
		description: 'Mermaid diagrams',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'embeds',
		package: '@mdsvex/plugin-embeds',
		import: 'embeds',
		description: 'YouTube and Vimeo players',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'figures',
		package: '@mdsvex/plugin-figures',
		import: 'figures',
		description: 'Figures and captions',
		headingIds: false,
		unwrapImages: true
	},
	{
		id: 'anchors',
		package: '@mdsvex/plugin-anchors',
		import: 'anchors',
		description: 'Links on headings',
		headingIds: true,
		unwrapImages: false
	},
	{
		id: 'toc',
		package: '@mdsvex/plugin-toc',
		import: 'toc',
		description: 'Table of contents',
		headingIds: true,
		unwrapImages: false
	},
	{
		id: 'external-links',
		package: '@mdsvex/plugin-external-links',
		import: 'external_links',
		description: 'External link policy',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'references',
		package: '@mdsvex/plugin-references',
		import: 'references',
		description: 'Links for users, issues and commits',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'citations',
		package: '@mdsvex/plugin-citations',
		import: 'citations',
		description: 'Citations and bibliographies',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'numbering',
		package: '@mdsvex/plugin-numbering',
		import: 'numbering',
		description: 'Numbering and cross-references',
		headingIds: true,
		unwrapImages: false
	},
	{
		id: 'page-data',
		package: '@mdsvex/plugin-page-data',
		import: 'page_data',
		description: 'Reading time, excerpts and page facts',
		headingIds: false,
		unwrapImages: false
	},
	{
		id: 'link-check',
		package: '@mdsvex/plugin-link-check',
		import: 'link_check',
		description: 'Broken link warnings',
		headingIds: true,
		unwrapImages: false
	}
] as const satisfies ReadonlyArray<{
	id: MdsvexPlugin;
	package: string;
	import: string;
	description: string;
	headingIds: boolean;
	unwrapImages: boolean;
}>;

export type MdsvexOptions = { plugins: MdsvexPlugin[] };

const defaultPlugins: readonly MdsvexPlugin[] = [
	'anchors',
	'code-blocks',
	'external-links',
	'figures',
	'page-data',
	'toc'
];

const promptPlugins = [...plugins].sort((a, b) => {
	const defaultOrder =
		Number(defaultPlugins.includes(b.id)) - Number(defaultPlugins.includes(a.id));
	return defaultOrder || a.id.localeCompare(b.id);
});

const options = defineAddonOptions<MdsvexOptions>()
	.add('plugins', {
		type: 'multiselect',
		question: 'Which plugins would you like to add?',
		options: promptPlugins.map((plugin) => ({
			value: plugin.id,
			label: plugin.id,
			hint: plugin.description
		})),
		default: [...defaultPlugins],
		required: false,
		searchable: true
	})
	.build();

const addon: Addon<AddonOptions<MdsvexOptions>, typeof ADDON_IDS.mdsvex> = defineAddon({
	id: ADDON_IDS.mdsvex,
	shortDescription: 'svelte + markdown',
	homepage: 'https://next.mdsvex.pages.dev',
	options,
	run: ({ sv, options, file, isKit, dependencyVersion }) => {
		const selected = plugins.filter((plugin) => options.plugins.includes(plugin.id));
		const prettierInstalled = Boolean(dependencyVersion('prettier'));

		sv.devDependency('mdsvex', 'next');
		if (prettierInstalled) sv.devDependency('@mdsvex/prettier-plugin', 'next');
		for (const plugin of selected) {
			sv.devDependency(plugin.package, 'next');
		}
		if (options.plugins.includes('diagram')) {
			// diagram() selects Mermaid when Pele is not installed.
			sv.devDependency('mermaid', '^12.3.0');
		}

		sv.file(
			file.viteConfig,
			transforms.script(({ ast, js }) => {
				js.imports.addNamed(ast, { from: 'mdsvex', imports: ['mdsvex'] });
				for (const plugin of selected) {
					js.imports.addNamed(ast, {
						from: plugin.package,
						imports: [plugin.import]
					});
				}

				const mdsvexOptions: string[] = [];
				if (selected.some((plugin) => plugin.headingIds)) {
					mdsvexOptions.push('heading_ids: true');
				}
				if (selected.some((plugin) => plugin.unwrapImages)) {
					mdsvexOptions.push('unwrap_images: true');
				}
				if (selected.length > 0) {
					mdsvexOptions.push(
						`plugins: [${selected.map((plugin) => `${plugin.import}()`).join(', ')}]`
					);
				}

				js.vite.addPlugin(ast, {
					code: mdsvexOptions.length === 0 ? 'mdsvex()' : `mdsvex({ ${mdsvexOptions.join(', ')} })`,
					mode: 'prepend'
				});

				if (isKit) return;

				// Without SvelteKit, mdsvex cannot register its extensions with
				// @sveltejs/vite-plugin-svelte, so add them to svelte() too.
				const svelteImport = js.imports
					.findAll(ast, { from: '@sveltejs/vite-plugin-svelte' })
					.find((found) => found.kind === 'static');
				if (!svelteImport || svelteImport.kind !== 'static') return;
				const svelteSpecifier = svelteImport.node.specifiers.find(
					(specifier) =>
						specifier.type === 'ImportSpecifier' &&
						specifier.imported.type === 'Identifier' &&
						specifier.imported.name === 'svelte'
				);
				if (!svelteSpecifier) return;

				const config = js.vite.getConfig(ast);
				const vitePlugins = js.vite.configProperty(ast, config, {
					name: 'plugins',
					fallback: js.array.create()
				});
				if (vitePlugins.type !== 'ArrayExpression') return;
				const svelteCall = vitePlugins.elements.find(
					(element) =>
						element?.type === 'CallExpression' &&
						element.callee.type === 'Identifier' &&
						element.callee.name === svelteSpecifier.local.name
				);
				if (!svelteCall || svelteCall.type !== 'CallExpression') return;
				const svelteOptions = js.functions.getArgument(svelteCall, {
					index: 0,
					fallback: js.object.create({})
				});
				if (svelteOptions.type !== 'ObjectExpression') return;
				const extensions = js.object.property(svelteOptions, {
					name: 'extensions',
					fallback: js.array.create()
				});
				if (extensions.type !== 'ArrayExpression') return;
				js.array.append(extensions, '.svelte');
				js.array.append(extensions, '.svx');
			})
		);

		sv.file(
			'.vscode/extensions.json',
			transforms.json(({ data, json }) => {
				json.arrayUpsert(data, 'recommendations', 'mdsvex.vscode-pfm');
			})
		);

		if (prettierInstalled) {
			sv.file(prettierConfigPath(), addPrettierMdsvex);
		}
	},
	nextSteps: () => [
		`Install the mdsvex extension for VS Code: ${color.website(
			'https://marketplace.visualstudio.com/items?itemName=mdsvex.vscode-pfm'
		)}`
	]
});

export default addon;
