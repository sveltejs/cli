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

export default defineAdder({
	id: 'community-addon',
	environments: { kit: true, svelte: true },
	options,
	packages: [],
	files: [
		{
			name: () => 'adder-template-demo.txt',
			content: ({ content, options }) => {
				if (options.demo) {
					return 'This is a text file made by the Community Adder Template demo!';
				}
				return content;
			}
		},
		{
			name: () => 'src/DemoComponent.svelte',
			content: ({ content, options, typescript }) => {
				if (!options.demo) return content;
				const { script, generateCode } = parseSvelte(content, { typescript });
				imports.addDefault(script.ast, '../adder-template-demo.txt?raw', 'demo');
				return generateCode({ script: script.generateCode(), template: '{demo}' });
			}
		}
	]
});
