import type { AstTypes, Comments, Package } from '@sveltejs/sv-utils';
import type { SvApi } from '../core/config.ts';
import type { Workspace } from '../core/workspace.ts';

/** Marker prefixing every manual follow-up a migration leaves in the user's code. */
export const MIGRATION_TASK_MARKER = '@migration-task';

let migrationTaskCount = 0;

/** Running total of `@migration-task` comments left in the user's code during this migration run. */
export function getMigrationTaskCount(): number {
	return migrationTaskCount;
}

/** Resets the running total; call before starting a migration run. */
export function resetMigrationTaskCount(): void {
	migrationTaskCount = 0;
}

/**
 * Leaves a standardized `@migration-task` comment on `node` for the user to resolve manually,
 * and bumps the running total so the post-migration summary can report it without re-reading files.
 */
export function addMigrationTask(
	comments: Comments,
	node: AstTypes.Node,
	message: string,
	options?: { position?: 'leading' | 'trailing' }
): void {
	comments.add(node, { type: 'Line', value: ` ${MIGRATION_TASK_MARKER} ${message}` }, options);
	migrationTaskCount++;
}

export type Migration = {
	id: string;
	changelog?: string;
	description: string;
	legacy?: boolean;
	setup: (options: MigrationSetupOptions) => Promise<void> | void;
	collect: (options: MigrationCollectOptions) => Promise<void> | void;
};

export type MigrationSetupOptions = {
	cwd: string;
	pkg: Package;
	requires: (migrationId: string) => void;
};

export type MigrationCollectOptions = {
	cwd: string;
	tasks: {
		add: (task: Task, options: TaskOptions) => void;
	};
};

export type TaskOptions = {
	required: boolean;
};

export type Task = {
	id: string;
	description: string;
	run: (options: TaskRunOptions) => Promise<void> | void;
};

export type TaskWithOptions = Task & TaskOptions;

export type TaskRunOptions = Workspace & { sv: SvApi };

export function defineMigration(migration: Migration) {
	return migration;
}

export function defineMigrationTask(task: Task) {
	return task;
}
