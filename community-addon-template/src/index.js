import { defineAddon, defineAddonOptions, js, svelte, parseSvelte } from 'sv/core';

export const options = defineAddonOptions()
	.add('demo', {
		question: 'Do you want to use a demo?',
		type: 'boolean',
		default: false
	})
	.build();

export default defineAddon({
	id: 'community-addon',
	options,
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},
	run: ({ sv, options, typescript }) => {
		sv.file('addon-template-demo.txt', (content) => {
			if (options.demo) {
				return 'This is a text file made by the Community Addon Template demo!';
			}
			return content;
		});

		sv.file('src/DemoComponent.svelte', (content) => {
			if (!options.demo) return content;
			const { ast, generateCode } = parseSvelte(content);
			svelte.ensureScript(ast, { langTs: typescript });
			js.imports.addDefault(ast.instance.content, {
				from: '../addon-template-demo.txt?raw',
				as: 'demo'
			});
			return generateCode();
		});
	}
});
