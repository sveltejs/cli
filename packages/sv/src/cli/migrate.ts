import path from 'node:path';
import process from 'node:process';
import * as p from '@clack/prompts';
import { color, loadPackageJson, type Package } from '@sveltejs/sv-utils';
import { Command } from 'commander';
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
import {
	type Migration,
	type MigrationCollectOptions,
	type MigrationSetupOptions,
	type TaskWithOptions
} from '../migrate/index.ts';
import {
	MIGRATION_TASK_MARKER,
	getMigrationTaskCount,
	resetMigrationTaskCount
} from '../migrate/migration-task.ts';
import appState from '../migrate/migrations/app-state/index.ts';
import { legacyMigrations } from '../migrate/migrations/legacy-migrations/index.ts';
import kit3 from '../migrate/migrations/sveltekit-3/index.ts';

// TODO: support historic migrations from `svelte-migrate` by handing over to `svelte-migrate`
const migrations = [kit3, appState, ...legacyMigrations] as const;
const MigrationScheme = v.optional(v.picklist(migrations.map((m) => m.id)));

export function normalizeTasksOption(tasks: string[] | true | undefined) {
	return tasks === true ? [] : tasks;
}

const OptionsSchema = v.strictObject({
	cwd: v.optional(v.string(), './'),
	files: v.optional(v.string()),
	gitCheck: v.boolean(),
	tasks: v.pipe(
		v.optional(v.union([v.array(v.string()), v.literal(true)])),
		v.transform(normalizeTasksOption)
	),
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
	.option(
		'--tasks [task...]',
		'migration tasks to run. Omit list of tasks to show available tasks. Use `--task all` to run all migration tasks.'
	)
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
			if (verifiedOptions.tasks?.length !== 0) {
				const verifications = [...verifyCleanWorkingDirectory(options.cwd, options.gitCheck)];
				await common.runAndValidateVerifications(verifications);
			}

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

			if (p.isCancel(verifiedMigrationName)) {
				p.cancel('Operation cancelled.');
				process.exit(1);
			}

			const migration = migrations.find((m) => m.id === verifiedMigrationName);
			if (!migration) {
				common.errorAndExit(`Migration ${verifiedMigrationName} not found`);
				return;
			}
			const legacyMigration = migration.legacy ?? false;
			if (legacyMigration && verifiedOptions.tasks !== undefined) {
				common.errorAndExit(`The migration ${migration.id} does not support task selection.`);
				return;
			}
			if (verifiedOptions.tasks?.length === 0) {
				const allTasks = await collectMigrationTasks(migration, verifiedOptions.cwd);
				if (allTasks.length === 0) {
					common.errorAndExit(`Migration "${migration.id}" did not return any tasks.`);
					return;
				}
				p.note(formatAvailableTasks(allTasks), `Available tasks for ${migration.id}`, {
					format: (line) => line
				});
				return;
			}

			const tasks = await determineTasks(migration, verifiedOptions, pkg);
			if (!tasks) return;

			resetMigrationTaskCount();
			const modifiedFiles = await applyTasks(verifiedOptions, tasks, legacyMigration);
			if (legacyMigration) return;

			const workspace = await createWorkspace({ cwd: verifiedOptions.cwd });
			await formatFiles({
				cwd: workspace.cwd,
				packageManager: workspace.packageManager,
				filesToFormat: modifiedFiles.values().toArray(),
				strategy: 'project-script-then-files-only'
			});

			const packageManager =
				verifiedOptions.install === false
					? null
					: verifiedOptions.install === true
						? await packageManagerPrompt(workspace.cwd)
						: verifiedOptions.install;
			if (packageManager) {
				await installDependencies(packageManager, workspace.cwd);
			}

			reportNextSteps();
		});
	});

function ensureValidWorkspace(cwd: string): Package | undefined {
	// each migration's `setup` decides what it actually needs; here we only
	// require a package.json to exist (loadPackageJson throws when it doesn't)
	try {
		return loadPackageJson(cwd).data;
	} catch {
		common.errorAndExit(
			`No package.json found in ${path.resolve(cwd)}.\n` +
				`Point to a project with ${color.command('--cwd <path>')}, or see ${color.command('sv migrate --help')}.`
		);
	}
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

	try {
		await migration.setup(setupOptions);
	} catch (err) {
		common.errorAndExit(err instanceof Error ? err.message : String(err));
		return;
	}

	if (requiredMigrations.length > 0) {
		common.errorAndExit(
			`The migration ${migration.id} requires the following migrations to be run first: ${requiredMigrations.join(
				', '
			)}`
		);
		return;
	}

	const allTasks = await collectMigrationTasks(migration, options.cwd);

	if (allTasks.length === 0) {
		common.errorAndExit(`Migration "${migration.id}" did not return any tasks to run.`);
		return;
	}

	const prerequisiteTasks = allTasks.filter((t) => t.prerequisite);
	const selectableTasks = allTasks.filter((t) => !t.prerequisite);
	// Don't show the recommended workflow when the user has already specified which tasks to run
	if (!options.tasks?.length && selectableTasks.length > 0) {
		const workflow = [];
		if (migration.changelog) {
			workflow.push(
				'Make sure to read the changelog for this migration before running it:',
				color.website(migration.changelog),
				''
			);
		}
		workflow.push(
			`To make migration changes easier to review, run ${color.command('one selectable task at a time')} and ${color.command('commit after each run')}.`,
			'Tasks are intended to create focused commits, not independent migration paths.',
			`Most projects need ${color.warning('all applicable tasks')} before they work correctly.`
		);
		p.note(workflow.join('\n'), 'Recommended workflow', { format: (line) => line });
	}

	const tasksToRun = [...prerequisiteTasks];
	if (options.tasks) {
		tasksToRun.push(...selectTasksFromArgs(options.tasks, selectableTasks));
	} else if (selectableTasks.length > 0) {
		const prerequisiteIds = prerequisiteTasks.map((t) => t.id).join(', ');
		const selectedTaskIds = await p.multiselect({
			message: prerequisiteTasks.length
				? `Select tasks to run; prerequisites always included: ${color.command(prerequisiteIds)}`
				: 'Select the tasks to run',
			options: selectableTasks.map((t) => ({
				value: t.id,
				label: t.id,
				hint: t.description
			})),
			required: false
		});

		if (p.isCancel(selectedTaskIds)) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}

		const selectedTasks = selectableTasks.filter((t) => selectedTaskIds.includes(t.id));
		tasksToRun.push(...selectedTasks);
	}

	if (tasksToRun.length === 0) {
		common.errorAndExit('No tasks selected to run.');
		return;
	}

	const recapMessage = tasksToRun
		.map(({ id, description }) => {
			return `${id} ${color.optional(`(${description})`)}`;
		})
		.join('\n- ');
	p.note(`- ${recapMessage}`, 'Migration steps', { format: (line) => line });

	if (!options.confirm) {
		const proceed = await p.confirm({
			message: 'Do you want to proceed?',
			initialValue: false
		});

		// a cancel is a truthy symbol, so it has to be checked before the falsy "no"
		if (p.isCancel(proceed)) {
			p.cancel('Operation cancelled.');
			process.exit(1);
		}

		if (!proceed) {
			common.errorAndExit('Migration cancelled by the user.');
			return;
		}
	}

	return tasksToRun;
}

async function collectMigrationTasks(migration: Migration, cwd: string) {
	const allTasks: TaskWithOptions[] = [];
	const collectOptions: MigrationCollectOptions = {
		cwd,
		tasks: {
			add: (task, options) => {
				allTasks.push({ ...task, ...options });
			}
		}
	};
	await migration.collect(collectOptions);
	return allTasks;
}

export function formatAvailableTasks(tasks: TaskWithOptions[]) {
	return tasks
		.map(
			({ id, description, prerequisite }) =>
				`- ${id}${prerequisite ? color.warning(' (prerequisite)') : ''}: ${color.optional(description)}`
		)
		.join('\n');
}

export function selectTasksFromArgs(selectedTaskIds: string[], selectableTasks: TaskWithOptions[]) {
	if (
		selectedTaskIds.length > 1 &&
		(selectedTaskIds.includes('all') || selectedTaskIds.includes('prerequisite'))
	) {
		common.errorAndExit(
			`The ${color.command('--tasks')} values ${color.command('all')} and ${color.command(
				'prerequisite'
			)} cannot be combined with other tasks.`
		);
	}

	if (selectedTaskIds[0] === 'prerequisite') {
		return [];
	}

	if (selectedTaskIds[0] === 'all') {
		return selectableTasks;
	}

	const invalidTasks = selectedTaskIds.filter((id) => !selectableTasks.some((t) => t.id === id));
	if (invalidTasks.length > 0) {
		common.errorAndExit(
			`Unknown migration task${invalidTasks.length === 1 ? '' : 's'}: ${invalidTasks
				.map((id) => color.command(id))
				.join(
					', '
				)}\nAvailable tasks: ${selectableTasks.map((t) => color.command(t.id)).join(', ')}`
		);
	}

	return selectableTasks.filter((task) => selectedTaskIds.includes(task.id));
}

/** Prints a summary of the `@migration-task` comments left for the user to resolve, if any. */
function reportNextSteps(): void {
	const total = getMigrationTaskCount();
	if (total === 0) return;

	const body = [
		`${total} ${total === 1 ? 'comment' : 'comments'} to review.`,
		`Search for ${color.command(MIGRATION_TASK_MARKER)} to resolve ${total === 1 ? 'it' : 'them'}.`
	];
	p.note(body.join('\n'), 'Next steps', { format: (line) => line });
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
		const skippedFiles = Array.from(allUnmodifiedFiles)
			.map((file) => `- ${color.path(file)}`)
			.join('\n');
		p.note(
			`Changes to these files were skipped because they did not\nmatch the ${color.command('--files')} filter:\n${skippedFiles}`,
			color.warning('Skipped changes'),
			{ format: (line) => line }
		);
	}

	return allModifiedFiles;
}
