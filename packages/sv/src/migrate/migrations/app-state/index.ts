import { color } from '@sveltejs/sv-utils';
import { defineMigration } from '../../index.ts';
import appState from './tasks/app-state.ts';

export default defineMigration({
	id: 'app-state',
	description: 'Migrate from "$app/stores" to "$app/state"',
	setup: ({ pkg }) => {
		const kitPackageName = '@sveltejs/kit';

		if (!pkg.devDependencies?.[kitPackageName])
			throw new Error(
				`${color.command(kitPackageName)} is not a devDependency in package.json - this doesn't look like a SvelteKit project.\n` +
					`Point to one with ${color.command('--cwd <path>')}, or see ${color.command('sv migrate --help')}.`
			);
	},
	collect: ({ tasks }) => {
		tasks.add(appState, { required: true });
	}
});
