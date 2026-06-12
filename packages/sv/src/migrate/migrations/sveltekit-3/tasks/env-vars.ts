import { defineMigrationTask } from '../../../index.ts';

export default defineMigrationTask({
	id: 'env-vars',
	description: 'tbd - migrate environment variables to the new format',
	setup: ({ skip }) => {
		if (someRandomCondition) {
			skip('This task is not needed because of some random condition');
		}
	},
	run: () => {
		console.log('Running migration task env-vars');
	}
});
