import * as p from '@clack/prompts';
import { color, loadPackageJson, type Package } from '@sveltejs/sv-utils';
import { Command } from 'commander';
import * as find from 'empathic/find';
import * as path from 'node:path';
import process from 'node:process';
import * as v from 'valibot';
import * as common from '../core/common.ts';
import { verifyCleanWorkingDirectory } from '../core/verifiers.ts';
import type {
	Migration,
	MigrationCollectOptions,
	MigrationSetupOptions,
	TaskWithOptions
} from '../migrate/index.ts';
import kit3 from '../migrate/migrations/sveltekit-3/index.ts';
import testMigration from '../migrate/migrations/test-migration/index.ts';

const migrations = [kit3, testMigration] as const;
const MigrationScheme = v.optional(v.picklist(migrations.map((m) => m.id)));

const OptionsSchema = v.strictObject({
	cwd: v.optional(v.string(), process.cwd()),
	gitCheck: v.boolean()
});
type Options = v.InferOutput<typeof OptionsSchema>;

export const migrate = new Command('migrate')
	.description('a CLI for migrating Svelte(Kit) codebases')
	.argument('[migration]', `migration to run`)
	.option('--cwd <path>', 'working directory to run the migration in')
	.option('--no-git-check', 'even if some files are dirty, no prompt will be shown')
	.action((migrationName, options) => {
		let verifiedMigrationName: string | symbol | undefined = v.parse(
			MigrationScheme,
			migrationName
		);

		const verifiedOptions = v.parse(OptionsSchema, options);

		common.runCommand(async () => {
			const pkg = ensureValidWorkspace(verifiedOptions.cwd);
			if (!pkg) return;

			// verifications
			const verifications = [...verifyCleanWorkingDirectory(options.cwd, options.gitCheck)];
			await common.runAndValidateVerifications(verifications);

			if (!verifiedMigrationName) {
				verifiedMigrationName = await p.select({
					message: 'Select a migration to run',
					options: migrations.map((m) => ({
						value: m.id,
						label: m.id,
						hint: m.description
					}))
				});
			}

			if (!verifiedMigrationName || typeof verifiedMigrationName === 'symbol') {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}

			const migration = migrations.find((m) => m.id === verifiedMigrationName);
			if (!migration) {
				common.errorAndExit(`Migration ${verifiedMigrationName} not found`);
				return;
			}

			p.log.warn(
				`Make sure to read the changelog for this migration before running it: ${migration.changelog}`
			);

			const tasks = await determineTasks(migration, verifiedOptions, pkg);
			if (!tasks) return;
			await applyTasks(tasks);
		});
	});

function ensureValidWorkspace(cwd: string) {
	const filePath = find.up('package.json', { cwd }) ?? path.join(cwd, 'package.json');

	if (!filePath) {
		common.errorAndExit(`No package.json found in ${cwd} or any of its parent directories.`);
	}

	const { data: pkg } = loadPackageJson(path.dirname(filePath));
	if (!pkg) {
		common.errorAndExit(`Failed to load package.json at ${filePath}.`);
		return;
	}

	if (!pkg.devDependencies?.['svelte'] && !pkg.devDependencies?.['@sveltejs/kit']) {
		common.errorAndExit(
			`No svelte or @sveltejs/kit dependency found in package.json at ${filePath}.`
		);
	}

	return pkg;
}

async function determineTasks(
	migration: Migration,
	options: Options,
	pkg: Package
): Promise<TaskWithOptions[] | undefined> {
	const requiredMigrations: string[] = [];
	const setupOptions: MigrationSetupOptions = {
		pkg,
		cwd: options.cwd,
		requires: (migrationId: string) => {
			requiredMigrations.push(migrationId);
		}
	};

	migration.setup(setupOptions);

	if (requiredMigrations.length > 0) {
		common.errorAndExit(
			`The migration ${migration.id} requires the following migrations to be run first: ${requiredMigrations.join(
				', '
			)}`
		);
		return;
	}

	const allTasks: TaskWithOptions[] = [];
	const collectOptions: MigrationCollectOptions = {
		cwd: options.cwd,
		tasks: {
			add: (task, options) => {
				allTasks.push({ ...task, ...options });
			}
		}
	};
	migration.collect(collectOptions);

	if (allTasks.length === 0) {
		common.errorAndExit(`Migration "${migration.id}" did not return any tasks to run.`);
		return;
	}

	const requiredTasks = allTasks.filter((t) => t.required);
	const optionalTasks = allTasks.filter((t) => !t.required);

	const tasksToRun = [...requiredTasks];
	if (optionalTasks.length > 0) {
		const optionalTaskIdsToRun = await p.multiselect({
			message: 'Select the tasks to run',
			options: optionalTasks.map((t) => ({
				value: t.id,
				label: t.id,
				hint: t.description
			})),
			initialValues: optionalTasks.filter((t) => t.required).map((t) => t.id)
		});

		if (typeof optionalTaskIdsToRun === 'symbol' || optionalTaskIdsToRun.length === 0) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}

		const optionalTasksToRun = optionalTasks.filter((t) => optionalTaskIdsToRun.includes(t.id));
		tasksToRun.push(...optionalTasksToRun);
	}

	if (tasksToRun.length === 0) {
		common.errorAndExit('No tasks selected to run.');
		return;
	}

	const tasksMessage = tasksToRun
		.map(({ id, description }) => `${id} ${color.dim(`(${description})`)}`)
		.join('\n- ');
	p.note(`- ${tasksMessage}`, 'Migration steps', { format: (line) => line });

	const proceed = await p.confirm({
		message: 'Do you want to proceed?',
		initialValue: false
	});

	if (!proceed) {
		common.errorAndExit('Migration cancelled by the user.');
		return;
	}

	return tasksToRun;
}

async function applyTasks(tasks: TaskWithOptions[]) {
	console.log('Applying tasks...', tasks);
}
