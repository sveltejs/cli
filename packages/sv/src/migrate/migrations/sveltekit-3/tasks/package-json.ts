import { isVersionUnsupportedBelow, loadPackageJson } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

// Only touched when already installed, never added.
const KIT3_MIN_VERSIONS = {
	vite: '^8.0.12',
	'@sveltejs/vite-plugin-svelte': '^7.0.0',
	svelte: '^5.56.4',
	// First version supporting TypeScript 6, via svelte2tsx@~0.7.55
	'@sveltejs/package': '^2.5.8',
	'svelte-check': '^4.7.5',
	typescript: '^6.0.0'
};

const ADAPTERS: Record<string, string | undefined> = {
	'@sveltejs/adapter-auto': '^8.0.0-next.0',
	'@sveltejs/adapter-cloudflare': '^8.0.0-next.0',
	'@sveltejs/adapter-netlify': '^7.0.0-next.0',
	'@sveltejs/adapter-node': '^6.0.0-next.0',
	'@sveltejs/adapter-static': '^4.0.0-next.0',
	'@sveltejs/adapter-vercel': '^7.0.0-next.0'
};

export default defineMigrationTask({
	id: 'package-json',
	description: 'Update package.json to be compatible with SvelteKit 3.0',
	run: ({ sv, cwd, dependencyVersion }) => {
		sv.devDependency('@sveltejs/kit', '^3.0.0-next.0');

		for (const [pkg, range] of Object.entries(KIT3_MIN_VERSIONS)) {
			const current = dependencyVersion(pkg);
			if (current && isVersionUnsupportedBelow(current, range)) sv.devDependency(pkg, range);
		}

		// Adapters track Kit's major, so installed adapters must move to their prerelease line too.
		const { data: pkg } = loadPackageJson(cwd);
		const dependencies = { ...pkg.devDependencies, ...pkg.dependencies };
		for (const name of Object.keys(dependencies)) {
			if (ADAPTERS[name]) sv.devDependency(name, ADAPTERS[name]);
		}
	}
});
