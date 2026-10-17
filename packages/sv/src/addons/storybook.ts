import process from 'node:process';
import { defineAddon } from '../core/config.ts';
import { getNodeTypesVersion } from './common.ts';
import { ADDON_IDS } from './ids.ts';

export default defineAddon({
	id: ADDON_IDS.storybook,
	shortDescription: 'frontend workshop',
	homepage: 'https://storybook.js.org',
	options: {},
	setup: ({ runsAfter }) => {
		runsAfter(ADDON_IDS.vitest);
		runsAfter(ADDON_IDS.eslint);
	},
	run: async ({ sv, packageManager }) => {
		const args = [`create-storybook@latest`, '--skip-install', '--no-dev'];

		// pnpm >= 10 ignores dependency build scripts by default and newer versions fail `dlx` on them
		if (packageManager === 'pnpm') args.unshift('--allow-build=esbuild');

		// skips the onboarding prompt during tests
		if (process.env.NODE_ENV?.toLowerCase() === 'test') args.push(...['--no-features', '--yes']);

		await sv.execute(args, 'inherit');
		sv.devDependency(`@types/node`, getNodeTypesVersion());
	}
});
