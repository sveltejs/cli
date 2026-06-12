import { defineMigrationTask } from '../../../index.ts';

export default defineMigrationTask({
	id: 'env-vars',
	description: 'tbd - migrate environment variables to the new format',
	run: () => {
		// console.log('Running migration task env-vars');
		// throw new Error('This is a test error in the env-vars task');
	}
});
