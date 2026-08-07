import { transforms } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';
import { migrateAppState, migrateAppStateModule } from './app-state/migrate.ts';

export default defineMigrationTask({
	id: 'app-state',
	description: 'Migrate from "$app/stores" to "$app/state"',
	run: ({ sv, language }) => {
		sv.files(
			{
				include: '**/*.{svelte,svelte.ts,svelte.js}',
				where: (content) => content.includes('$app/stores')
			},
			(content, path) => {
				if (path.endsWith('.svelte')) {
					return transforms.svelteScript({ language }, ({ ast }) => {
						if (!migrateAppState(ast.instance.content, ast.fragment)) return false;
					})(content);
				}

				// `.svelte.ts` / `.svelte.js` modules
				return transforms.script(({ ast, comments }) => {
					if (!migrateAppStateModule(ast, comments)) return false;
				})(content);
			}
		);
	}
});
