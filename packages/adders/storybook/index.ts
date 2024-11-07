import { defineAdder } from '@sveltejs/cli-core';

export default defineAdder({
	id: 'storybook',
	environments: { kit: true, svelte: true },
	homepage: 'https://storybook.js.org',
	options: {},
	packages: [],
	scripts: [
		{
			description: 'applies storybook',
			args: ['storybook@8.3', 'init', '--skip-install', '--no-dev'],
			stdio: 'inherit'
		}
	],
	files: []
});
