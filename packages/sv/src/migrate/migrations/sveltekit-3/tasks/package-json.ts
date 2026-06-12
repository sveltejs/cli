import { defineMigrationTask } from '../../../index.ts';

export default defineMigrationTask({
	id: 'package-json',
	description: 'Update package.json to be compatible with SvelteKit 3.0',
	setup: ({ skip }) => {
		if (someRandomCondition) {
			skip('This task is not needed because of some random condition');
		}
	},
	run: () => {
		console.log('Running migration task package-json');
	}
});
