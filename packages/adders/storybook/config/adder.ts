import { defineAdder } from '@svelte-cli/core';
import { options } from './options.ts';

export const adder = defineAdder({
	id: 'storybook',
	name: 'Storybook',
	description: 'Build UIs without the grunt work',
	environments: { kit: true, svelte: true },
	logo: './storybook.svg',
	documentation: 'https://storybook.js.org/docs/get-started',
	packages: [],
	scripts: [
		{
			description: 'applies storybook',
			args: ['storybook@latest', 'init', '--skip-install', '--no-dev'],
			stdio: 'inherit'
		}
	],
	options,
	files: []
});
