import type { Package } from '@sveltejs/sv-utils';
import type { SvApi } from '../core/config.ts';
import type { Workspace } from '../core/workspace.ts';

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
	prerequisite: boolean;
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
