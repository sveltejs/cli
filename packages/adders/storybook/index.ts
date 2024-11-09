import { defineAdder } from '@sveltejs/cli-core';

export default defineAdder({
	id: 'storybook',
	homepage: 'https://storybook.js.org',
	options: {},
	run: ({ sv }) => {
		sv.execute(['storybook@8.3.6', 'init', '--skip-install', '--no-dev'], 'inherit');
	}
});
