import { defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { imports } from '@sveltejs/cli-core/js';
import { parseSvelte } from '@sveltejs/cli-core/parsers';

export const options = defineAddonOptions({
	demo: {
		question: 'Do you want to use a demo?',
		type: 'boolean',
		default: false
	}
});

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
			const { script, generateCode } = parseSvelte(content, { typescript });
			imports.addDefault(script.ast, { from: '../addon-template-demo.txt?raw', as: 'demo' });
			return generateCode({ script: script.generateCode(), template: '{demo}' });
		});
	}
});
