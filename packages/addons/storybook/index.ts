import { defineAddon } from '@sveltejs/cli-core';

export default defineAddon({
	id: 'storybook',
	homepage: 'https://storybook.js.org',
	options: {},
	run: async ({ sv }) => {
		await sv.execute(['storybook@latest', 'init', '--skip-install', '--no-dev'], 'inherit');
	}
});
