export type Migration = {
	id: string;
	changelog: string;
	description: string;
	setup: (options: MigrationSetupOptions) => Promise<void> | void;
	collect: (options: MigrationCollectOptions) => Promise<void> | void;
};

export type MigrationSetupOptions = {
	requires: (migrationId: string) => void;
};

export type MigrationCollectOptions = {
	tasks: {
		add: (task: Task, options: { required: boolean }) => void;
	};
};

export type Task = {
	id: string;
	description: string;
	setup: (options: TaskSetupOptions) => Promise<void> | void;
	run: () => Promise<void> | void;
};

export type TaskSetupOptions = {
	skip: (reason?: string) => void;
	alreadyApplied: () => void;
};

export function defineMigration(migration: Migration) {
	console.log(migration);
	return migration;
}

export function defineMigrationTask(task: Task) {
	console.log(task);
	return task;
}
