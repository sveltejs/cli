import { options } from './options.js';
import { defineAdder } from '@svelte-cli/core';
import { imports } from '@svelte-cli/core/js';
import { parseScript } from '@svelte-cli/core/parsers';

export const adder = defineAdder({
	id: 'community-adder-template',
	name: 'Community Adder Template',
	description: 'An adder template demo',
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
			content: ({ content }) => {
				const { ast, generateCode } = parseScript(content);
				imports.addDefault(ast, '../adder-template-demo.txt?raw', 'Demo');
				return generateCode();
			}
		}
	]
});
