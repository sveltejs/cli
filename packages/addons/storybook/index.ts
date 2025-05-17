import { defineAddon } from '@sveltejs/cli-core';
import { getNodeTypesVersion } from '../common.ts';

export default defineAddon({
	id: 'storybook',
	shortDescription: 'frontend workshop',
	homepage: 'https://storybook.js.org',
	options: {},
	setup: ({ runsAfter }) => {
		runsAfter('vitest');
		runsAfter('eslint');
	},
	run: async ({ sv }) => {
		await sv.execute(['storybook@latest', 'init', '--skip-install', '--no-dev'], 'inherit');
		sv.devDependency(`@types/node`, getNodeTypesVersion());
	}
});
