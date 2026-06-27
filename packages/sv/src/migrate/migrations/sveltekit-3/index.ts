import { coerceVersion, color } from '@sveltejs/sv-utils';
import { defineMigration } from '../../index.ts';
import appState from '../app-state/tasks/app-state.ts';
import environment from './tasks/environment.ts';
import packageJson from './tasks/package-json.ts';
import svelteConfig from './tasks/svelte-config.ts';

export default defineMigration({
	id: 'sveltekit-3',
	changelog: 'https://svelte.dev/blog/whatever',
	description: 'A set of migrations for SvelteKit 3.0',
	setup: ({ pkg, requires }) => {
		const kitPackageName = '@sveltejs/kit';

		if (!pkg.devDependencies?.[kitPackageName])
			throw new Error(
				`${color.command(kitPackageName)} is not a devDependency in package.json - this doesn't look like a SvelteKit project.\n` +
					`Point to one with ${color.command('--cwd <path>')}, or see ${color.command('sv migrate --help')}.`
			);

		const kitVersion = coerceVersion(pkg.devDependencies[kitPackageName]);
		if (kitVersion.major && kitVersion.major < 2) {
			requires('sveltekit-2');
		}
	},
	collect: ({ tasks }) => {
		tasks.add(packageJson, { required: true });
		tasks.add(svelteConfig, { required: true });
		tasks.add(environment, { required: false });
		tasks.add(appState, { required: true });
	}
});
