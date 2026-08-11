import { coerceVersion, color } from '@sveltejs/sv-utils';
import { defineMigration } from '../../index.ts';
import appState from '../app-state/tasks/app-state.ts';
import collectMigrationInstructions from './tasks/collect-migration-instructions.ts';
import environment from './tasks/environment.ts';
import externalRedirects from './tasks/external-redirects.ts';
import imports from './tasks/imports.ts';
import libAlias from './tasks/lib-alias.ts';
import packageJson from './tasks/package-json.ts';
import params from './tasks/params.ts';
import paths from './tasks/paths.ts';
import shallowRouting from './tasks/shallow-routing.ts';
import svelteConfig from './tasks/svelte-config.ts';
import tsconfig from './tasks/tsconfig.ts';

export default defineMigration({
	id: 'sveltekit-3',
	changelog: 'https://next.svelte.dev/docs/kit/migrating-to-sveltekit-3',
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
		// required
		tasks.add(packageJson, { prerequisite: true });
		tasks.add(tsconfig, { prerequisite: true });

		// optional
		tasks.add(svelteConfig, { prerequisite: false });
		tasks.add(environment, { prerequisite: false });
		tasks.add(paths, { prerequisite: false });
		tasks.add(externalRedirects, { prerequisite: false });
		tasks.add(shallowRouting, { prerequisite: false });
		tasks.add(params, { prerequisite: false });
		tasks.add(imports, { prerequisite: false });
		tasks.add(libAlias, { prerequisite: false });
		tasks.add(appState, { prerequisite: false });
		tasks.add(collectMigrationInstructions, { prerequisite: false });
	}
});
