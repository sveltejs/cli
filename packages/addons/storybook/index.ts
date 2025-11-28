import process from 'node:process';
import { defineAddon } from '@sveltejs/cli-core';
import { getNodeTypesVersion } from '../common.ts';

export const STORYBOOK_VERSION = '10.1.0';

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
		const args = [
			`create-storybook@${STORYBOOK_VERSION}`,
			'--skip-install',
			'--no-dev',
			'--no-features'
		];

		// skips the onboarding prompt during tests
		if (process.env.NODE_ENV?.toLowerCase() === 'test') args.push('--yes');

		await sv.execute(args, 'inherit');
		sv.devDependency(`@types/node`, getNodeTypesVersion());
	}
});
