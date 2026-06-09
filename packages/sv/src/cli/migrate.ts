import * as p from '@clack/prompts';
import { Command } from 'commander';
import process from 'node:process';
import * as v from 'valibot';
import * as common from '../core/common.ts';
import type { Migration, MigrationCollectOptions } from '../migrate/index.ts';
import kit3 from '../migrate/migrations/kit-3/index.ts';
import testMigration from '../migrate/migrations/test-migration/index.ts';

const migrations = [kit3, testMigration] as const;
const MigrationScheme = v.optional(v.picklist(migrations.map((m) => m.id)));

const OptionsSchema = v.strictObject({
	cwd: v.optional(v.string(), process.cwd())
});

export const migrate = new Command('migrate')
	.description('a CLI for migrating Svelte(Kit) codebases')
	.argument('[migration]', `migration to run`)
	.action((migrationName, options) => {
		let verifiedMigrationName = v.parse(MigrationScheme, migrationName);

		const blabub2 = v.parse(OptionsSchema, options);
		console.log('Options', blabub2);

		common.runCommand(async () => {
			if (!verifiedMigrationName) {
				verifiedMigrationName = (await p.select({
					message: 'Select a migration to run',
					options: migrations.map((m) => ({ value: m.id, label: `${m.id}: ${m.description}` }))
				})) as string;
			}

			const migration = migrations.find((m) => m.id === verifiedMigrationName);
			if (!migration) {
				common.errorAndExit(`Migration ${verifiedMigrationName} not found`);
				return;
			}

			p.log.warn(
				`Make sure to read the changelog for this migration before running it: ${migration.changelog}`
			);

			runMigration(migration);
		});
	});

function runMigration(migration: Migration) {
	console.log('Doing stuff...');

	const collectOptions: MigrationCollectOptions = {
		tasks: {
			add: (task, options) => {
				console.log('Adding task', task, 'with options', options);
			}
		}
	};

	migration.collect(collectOptions);
}
