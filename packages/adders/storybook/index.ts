import { defineAdder } from '@sveltejs/cli-core';

export default defineAdder({
	id: 'storybook',
	name: 'Storybook',
	description: 'Build UIs without the grunt work',
	environments: { kit: true, svelte: true },
	homepage: 'https://storybook.js.org',
	options: {},
	packages: [],
	scripts: [
		{
			description: 'applies storybook',
			args: ['storybook@latest', 'init', '--skip-install', '--no-dev'],
			stdio: 'inherit'
		}
	],
	files: []
});
