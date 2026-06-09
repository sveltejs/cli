import { defineMigration } from '../../index.ts';
import packageJson from './tasks/package-json.ts';

export default defineMigration({
	id: 'kit-3',
	changelog: 'https://svelte.dev/blog/whatever',
	description: 'A set of migrations for SvelteKit 3.0',
	setup: ({ requires }) => {
		if (notKit2) {
			requires('kit-2');
		}
	},
	collect: ({ tasks }) => {
		console.log('Running migration kit-3');
		tasks.add(packageJson, { required: true });
	}
});
