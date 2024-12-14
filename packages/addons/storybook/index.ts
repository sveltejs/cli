import { defineAddon } from '@sveltejs/cli-core';

export default defineAddon({
	id: 'storybook',
	shortDescription: 'frontend workshop',
	homepage: 'https://storybook.js.org',
	options: {},
	run: async ({ sv }) => {
		await sv.execute(['storybook@latest', 'init', '--skip-install', '--no-dev'], 'inherit');
	}
});
