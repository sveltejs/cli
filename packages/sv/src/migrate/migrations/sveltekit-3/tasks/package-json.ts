import experimentalAddon from '../../../../addons/experimental.ts';
import { defineMigrationTask } from '../../../index.ts';

export default defineMigrationTask({
	id: 'package-json',
	description: 'Update package.json to be compatible with SvelteKit 3.0',
	run: (args) => {
		// instead of duplicating the logic of the experimental addon, lets just call it.
		// migrates kit to it's 'next' version.
		experimentalAddon.run({
			...args,
			options: { versions: ['kit'], features: [] },
			cancel: () => {}
		});
	}
});
