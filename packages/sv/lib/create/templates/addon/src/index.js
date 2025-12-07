import { defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { imports } from '@sveltejs/cli-core/js';
import { parseSvelte } from '@sveltejs/cli-core/parsers';

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
		sv.file('src/lib/add-on/addon-template-demo.txt', (content) => {
			if (!options.demo) return content;
			return 'This is a text file made by the Community Addon Template demo! with your add-on: ~SV-NAME-TODO~!';
		});

		sv.file('src/lib/add-on/DemoComponent.svelte', (content) => {
			if (!options.demo) return content;
			const { script, generateCode } = parseSvelte(content, { typescript });
			imports.addDefault(script.ast, { from: './addon-template-demo.txt?raw', as: 'demo' });
			return generateCode({ script: script.generateCode(), template: '{demo}' });
		});

		sv.file('src/routes/+page.svelte', (content) => {
			if (!options.demo) return content;
			const { script, generateCode, template } = parseSvelte(content, { typescript });
			imports.addDefault(script.ast, {
				from: '$lib/add-on/DemoComponent.svelte',
				as: 'DemoComponent'
			});
			return generateCode({
				script: script.generateCode(),
				template: template.generateCode() + '\n\n<DemoComponent />'
			});
		});
	}
});
