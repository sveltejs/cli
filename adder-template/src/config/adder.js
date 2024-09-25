import { defineAdderConfig } from '@svelte-cli/core';
import { options } from './options.js';

export const adder = defineAdderConfig({
	metadata: {
		id: 'adder-template',
		name: 'Adder Template',
		description: 'An adder template demo',
		environments: { kit: true, svelte: true }
	},
	options,
	integrationType: 'inline',
	packages: [],
	files: [
		{
			name: () => 'adder-template-demo.txt',
			contentType: 'text',
			content: ({ content, options }) => {
				if (options.demo) {
					return 'This is a text file made by the Adder Template demo!';
				}
				return content;
			}
		},
		{
			name: () => 'src/DemoComponent.svelte',
			contentType: 'svelte',
			content: ({ js }) => {
				js.imports.addDefault(js.ast, '../adder-template-demo.txt?raw', 'Demo');
			}
		}
	]
});
