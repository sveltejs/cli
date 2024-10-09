import { options } from './options.js';
import { defineAdderConfig } from '@svelte-cli/core';
import { imports } from '@svelte-cli/core/js';

export const adder = defineAdderConfig({
	metadata: {
		id: 'community-adder-template',
		name: 'Community Adder Template',
		description: 'An adder template demo',
		environments: { kit: true, svelte: true }
	},
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
			contentType: 'svelte',
			content: ({ jsAst }) => {
				imports.addDefault(jsAst, '../adder-template-demo.txt?raw', 'Demo');
			}
		}
	]
});
