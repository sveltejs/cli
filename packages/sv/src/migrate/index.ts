import type { Package } from '@sveltejs/sv-utils';

export type Migration = {
	id: string;
	changelog: string;
	description: string;
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
	setup: (options: TaskSetupOptions) => Promise<void> | void;
	run: () => Promise<void> | void;
};

export type TaskWithOptions = Task & TaskOptions;

export type TaskSetupOptions = {
	skip: (reason?: string) => void;
};

export function defineMigration(migration: Migration) {
	return migration;
}

export function defineMigrationTask(task: Task) {
	return task;
}
