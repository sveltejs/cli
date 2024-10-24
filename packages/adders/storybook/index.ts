import { defineAdder } from '@sveltejs/cli-core';

export default defineAdder({
	id: 'storybook',
	environments: { kit: true, svelte: true },
	homepage: 'https://storybook.js.org',
	options: {},
	run: ({ sv }) => {
		sv.execute({
			args: ['storybook@latest', 'init', '--skip-install', '--no-dev'],
			stdio: 'inherit'
		});
	}
});
