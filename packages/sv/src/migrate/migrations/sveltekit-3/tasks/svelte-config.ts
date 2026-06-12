import { defineMigrationTask } from '../../../index.ts';

export default defineMigrationTask({
	id: 'svelte-config',
	description: 'tbd - migrate svelte.config.js to be compatible with SvelteKit 3.0',
	run: () => {
		// console.log('Running migration task svelte-config');
	}
});
