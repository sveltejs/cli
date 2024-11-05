import { defineAdder, defineAdderOptions } from '@sveltejs/cli-core';
import { imports } from '@sveltejs/cli-core/js';
import { parseSvelte } from '@sveltejs/cli-core/parsers';

export const options = defineAdderOptions({
	demo: {
		question: 'Do you want to use a demo?',
		type: 'boolean',
		default: false
	}
});

export const adder = defineAdder({
	id: 'community-adder-template',
	options,
	setup: ({ kit, unavailable }) => {
		if (!kit) unavailable();
	},
	run: ({ sv }) => {
		sv.file('adder-template-demo.txt', (content) => {
			if (options.demo) {
				return 'This is a text file made by the Community Adder Template demo!';
			}
			return content;
		});

		sv.file('src/DemoComponent.svelte', (content) => {
			const { script, generateCode } = parseSvelte(content);
			imports.addDefault(script.ast, '../adder-template-demo.txt?raw', 'Demo');
			return generateCode({ script: script.generateCode() });
		});
	}
});
