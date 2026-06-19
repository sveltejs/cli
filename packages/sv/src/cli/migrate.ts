import * as p from '@clack/prompts';
import { color, loadPackageJson, type Package } from '@sveltejs/sv-utils';
import { Command } from 'commander';
import process from 'node:process';
import * as v from 'valibot';
import * as common from '../core/common.ts';
import { prepareSvApi } from '../core/engine.ts';
import { formatFiles } from '../core/formatFiles.ts';
import {
	AGENT_NAMES,
	installDependencies,
	installOption,
	packageManagerPrompt
} from '../core/package-manager.ts';
import { verifyCleanWorkingDirectory } from '../core/verifiers.ts';
import { createWorkspace } from '../core/workspace.ts';
import type {
	Migration,
	MigrationCollectOptions,
	MigrationSetupOptions,
	TaskWithOptions
} from '../migrate/index.ts';
import { legacyMigrations } from '../migrate/migrations/legacy-migrations/index.ts';
import kit3 from '../migrate/migrations/sveltekit-3/index.ts';

// TODO: support historic migrations from `svelte-migrate` by handing over to `svelte-migrate`
const migrations = [kit3, ...legacyMigrations] as const;
const MigrationScheme = v.optional(v.picklist(migrations.map((m) => m.id)));

const OptionsSchema = v.strictObject({
	cwd: v.optional(v.string(), './'),
	files: v.optional(v.string()),
	gitCheck: v.boolean(),
	tasks: v.optional(v.array(v.string())),
	confirm: v.optional(v.boolean(), false),
	install: v.optional(v.union([v.boolean(), v.picklist(AGENT_NAMES)]), true)
});
type Options = v.InferOutput<typeof OptionsSchema>;

export const migrate = new Command('migrate')
	.description('a CLI for migrating Svelte(Kit) codebases')
	.argument('[migration]', `migration to run`)
	.option('--cwd <path>', 'working directory to run the migration in')
	.option(
		'--files <glob>',
		'only run the migration on a subset of files matching the provided glob pattern'
	)
	.option('--no-git-check', 'even if some files are dirty, no prompt will be shown')
	.option('--tasks <task...>', 'migration tasks to run')
	.option('--confirm', 'skip the final confirmation prompt')
	.option('--no-install', 'skip installing dependencies')
	.addOption(installOption)
	.action((migrationName, options) => {
		if (hasInstallConflict(process.argv)) {
			common.errorAndExit(
				`The ${color.command('--install')} and ${color.command(
					'--no-install'
				)} options cannot be used together.`
			);
			return;
		}

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
			const legacyMigration = migration.legacy ?? false;
			if (legacyMigration && verifiedOptions.tasks) {
				common.errorAndExit(`The migration ${migration.id} does not support task selection.`);
				return;
			}

			if (migration.changelog) {
				p.log.warn(
					`Make sure to read the changelog for this migration before running it: ${migration.changelog}`
				);
			}

			const tasks = await determineTasks(migration, verifiedOptions, pkg);
			if (!tasks) return;

			const modifiedFiles = await applyTasks(verifiedOptions, tasks, legacyMigration);
			if (legacyMigration) return;

			const workspace = await createWorkspace({ cwd: verifiedOptions.cwd });
			const hasFormatter = !!workspace.dependencyVersion('prettier');
			if (hasFormatter) {
				await formatFiles({
					cwd: workspace.cwd,
					packageManager: workspace.packageManager,
					filesToFormat: modifiedFiles.values().toArray()
				});
			}

			const packageManager =
				verifiedOptions.install === false
					? null
					: verifiedOptions.install === true
						? await packageManagerPrompt(workspace.cwd)
						: verifiedOptions.install;
			if (packageManager) {
				await installDependencies(packageManager, workspace.cwd);
			}
		});
	});

function ensureValidWorkspace(cwd: string) {
	const { data: pkg, source } = loadPackageJson(cwd);
	if (!pkg) {
		common.errorAndExit(`Failed to load package.json at ${source}.`);
		return;
	}

	if (!pkg.devDependencies?.['svelte'] && !pkg.devDependencies?.['@sveltejs/kit']) {
		common.errorAndExit(
			`No svelte or @sveltejs/kit dependency found in package.json at ${source}.`
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
	if (options.tasks) {
		tasksToRun.push(...selectOptionalTasksFromArgs(options.tasks, optionalTasks));
	} else if (optionalTasks.length > 0) {
		const optionalTaskIdsToRun = await p.multiselect({
			message: 'Select the tasks to run',
			options: optionalTasks.map((t) => ({
				value: t.id,
				label: t.id,
				hint: t.description
			})),
			initialValues: optionalTasks.filter((t) => t.required).map((t) => t.id),
			required: false
		});

		if (typeof optionalTaskIdsToRun === 'symbol') {
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

	if (!options.confirm) {
		const proceed = await p.confirm({
			message: 'Do you want to proceed?',
			initialValue: false
		});

		if (!proceed) {
			common.errorAndExit('Migration cancelled by the user.');
			return;
		}
	}

	return tasksToRun;
}

export function selectOptionalTasksFromArgs(
	selectedTaskIds: string[],
	optionalTasks: TaskWithOptions[]
) {
	if (
		selectedTaskIds.length > 1 &&
		(selectedTaskIds.includes('all') || selectedTaskIds.includes('required'))
	) {
		common.errorAndExit(
			`The ${color.command('--tasks')} values ${color.command('all')} and ${color.command(
				'required'
			)} cannot be combined with other tasks.`
		);
	}

	if (selectedTaskIds[0] === 'required') {
		return [];
	}

	if (selectedTaskIds[0] === 'all') {
		return optionalTasks;
	}

	const invalidTasks = selectedTaskIds.filter((id) => !optionalTasks.some((t) => t.id === id));
	if (invalidTasks.length > 0) {
		common.errorAndExit(
			`Unknown migration task${invalidTasks.length === 1 ? '' : 's'}: ${invalidTasks
				.map((id) => color.command(id))
				.join(', ')}\nAvailable tasks: ${optionalTasks.map((t) => color.command(t.id)).join(', ')}`
		);
	}

	return optionalTasks.filter((task) => selectedTaskIds.includes(task.id));
}

export function hasInstallConflict(argv: string[]) {
	return (
		argv.some((arg) => arg === '--install' || arg.startsWith('--install=')) &&
		argv.includes('--no-install')
	);
}

async function applyTasks(options: Options, tasks: TaskWithOptions[], legacyMigration: boolean) {
	let allModifiedFiles = new Set<string>();
	let allUnmodifiedFiles = new Set<string>();
	const { start, stop, message, error } = p.spinner();

	if (!legacyMigration) start('Applying migration tasks...');

	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i];
		if (!legacyMigration) message(`${i + 1}/${tasks.length}: ${task.id}`);
		try {
			// reload workspace for each task to ensure a clean state, as tasks might make changes to the file system that affect subsequent tasks
			const workspace = await createWorkspace({ cwd: options.cwd });
			const { sv, finalize } = prepareSvApi(workspace, {
				executeOutputPrefix: `${task.id}:`,
				filesFilter: options.files
			});

			await task.run({ sv, ...workspace });

			if (!legacyMigration) {
				const { modifiedFiles, unmodifiedFiles } = finalize();
				allModifiedFiles = allModifiedFiles.union(modifiedFiles);
				allUnmodifiedFiles = allUnmodifiedFiles.union(unmodifiedFiles);
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			const message = `Task '${task.id}' failed: ${errorMessage}`;
			if (!legacyMigration) error(message);
			p.log.message();
			p.cancel('Migration failed.');
			process.exit(1);
		}
	}

	if (!legacyMigration) stop('All tasks applied successfully!');

	if (allUnmodifiedFiles.size > 0) {
		p.note(
			`The following files were modified by the migration,\nbut their content was not saved:\n- ${Array.from(
				allUnmodifiedFiles
			).join('\n- ')}`,
			'Unmodified files',
			{ format: (line) => line }
		);
	}

	return allModifiedFiles;
}
