import { defineMigration } from '../../index.ts';

export default defineMigration({
	id: 'test-migration',
	changelog: 'https://svelte.dev/blog/whatever2',
	description: 'A test migration for testing the migration system',
	setup: () => {
		console.log('Setting up migration test-migration');
	},
	collect: () => {
		console.log('Running migration test-migration');
	}
});
