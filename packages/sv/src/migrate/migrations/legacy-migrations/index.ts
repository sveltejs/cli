import { defineMigration, defineMigrationTask } from '../../index.ts';

function legacyTask(name: string, description: string) {
	return defineMigrationTask({
		id: name,
		description,
		run: async ({ sv }) => {
			// let's just call the old migration from svelte-migrate, but use version 1.
			// version 2 is the deprecated version which redirects the users to use `sv migrate`
			await sv.execute(['svelte-migrate@1', name], 'inherit');
		}
	});
}

function legacyMigration(name: string, description: string) {
	return defineMigration({
		id: name,
		description,
		legacy: true,
		setup: () => {},
		collect: ({ tasks }) => {
			tasks.add(legacyTask(name, description), { required: true });
		}
	});
}

export const legacyMigrations = [
	legacyMigration('svelte-5', 'Migrate from Svelte 4 to Svelte 5'),
	legacyMigration('self-closing-tags', 'Migrate to the new self-closing tag syntax'),
	legacyMigration('svelte-4', 'Migrate from Svelte 3 to Svelte 4'),
	legacyMigration('sveltekit-2', 'Migrate from SvelteKit 1.0 to SvelteKit 2.0'),
	legacyMigration('package', 'Migrate from @sveltejs/package@1 to @sveltejs/package@2'),
	legacyMigration('routes', 'Migrate from SvelteKit pre-1.0 routing to SvelteKit 1.0 routing')
];
