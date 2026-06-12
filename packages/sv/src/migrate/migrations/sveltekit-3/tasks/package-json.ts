import experimentalAddon from '../../../../addons/experimental.ts';
import { defineMigrationTask } from '../../../index.ts';

export default defineMigrationTask({
	id: 'package-json',
	description: 'Update package.json to be compatible with SvelteKit 3.0',
	run: ({ cwd, language, sv, dependencyVersion, file, isKit, directory, packageManager }) => {
		// instead of duplicating the logic of the experimental addon, lets just call it.
		// migrates kit to it's 'next' version.
		experimentalAddon.run({
			cwd,
			language,
			sv,
			dependencyVersion,
			file,
			isKit,
			directory,
			packageManager,
			options: { versions: ['kit'], features: [] },
			cancel: () => {}
		});
	}
});
