import { coerceVersion } from '@sveltejs/sv-utils';
import { defineMigration } from '../../index.ts';
import envVars from './tasks/env-vars.ts';
import packageJson from './tasks/package-json.ts';
import svelteConfig from './tasks/svelte-config.ts';

export default defineMigration({
	id: 'sveltekit-3',
	changelog: 'https://svelte.dev/blog/whatever',
	description: 'A set of migrations for SvelteKit 3.0',
	setup: ({ pkg, requires }) => {
		const kitPackageName = '@sveltejs/kit';

		if (!pkg.devDependencies?.[kitPackageName])
			throw new Error(`${kitPackageName} is not listed as a devDependency in package.json`);

		const kitVersion = coerceVersion(pkg.devDependencies[kitPackageName]);
		if (kitVersion.major && kitVersion.major < 2) {
			requires('sveltekit-2');
		}
	},
	collect: ({ tasks }) => {
		tasks.add(packageJson, { required: true });
		tasks.add(svelteConfig, { required: false });
		tasks.add(envVars, { required: false });
	}
});
