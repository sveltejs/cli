import process from 'node:process';
import type { AstTypes, Comments } from '@sveltejs/sv-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type TaskWithOptions } from '../../migrate/index.ts';
import {
	addMigrationTask,
	getMigrationTaskCount,
	resetMigrationTaskCount
} from '../../migrate/migration-task.ts';
import {
	formatAvailableTasks,
	hasInstallConflict,
	migrate,
	normalizeTasksOption,
	selectTasksFromArgs
} from '../migrate.ts';

const selectableTasks: TaskWithOptions[] = [
	{
		id: 'svelte-config',
		description: 'migrate svelte.config.js',
		prerequisite: false,
		run: () => {}
	},
	{
		id: 'env-vars',
		description: 'migrate environment variables',
		prerequisite: false,
		run: () => {}
	}
];

function mockExit() {
	vi.spyOn(process, 'exit').mockImplementation(((code: string | number | null | undefined) => {
		throw new Error(`exit ${code}`);
	}) as never);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('--tasks option', () => {
	it('accepts no task values', () => {
		const option = migrate.options.find((option) => option.long === '--tasks');

		expect(option).toMatchObject({ optional: true, variadic: true });
		expect(normalizeTasksOption(true)).toEqual([]);
	});

	it('preserves explicitly selected tasks', () => {
		expect(normalizeTasksOption(['environment', 'paths'])).toEqual(['environment', 'paths']);
	});

	it('formats prerequisite and selectable tasks', () => {
		expect(formatAvailableTasks(selectableTasks)).toBe(
			'- svelte-config: migrate svelte.config.js\n- env-vars: migrate environment variables'
		);
		expect(formatAvailableTasks([{ ...selectableTasks[0], prerequisite: true }])).toContain(
			'svelte-config (prerequisite)'
		);
	});
});

describe('selectTasks', () => {
	it('selects all selectable tasks', () => {
		expect(selectTasksFromArgs(['all'], selectableTasks)).toEqual(selectableTasks);
	});

	it('selects only prerequisite tasks', () => {
		expect(selectTasksFromArgs(['prerequisite'], selectableTasks)).toEqual([]);
	});

	it('selects specific optional tasks', () => {
		expect(selectTasksFromArgs(['env-vars'], selectableTasks)).toEqual([selectableTasks[1]]);
	});

	it('exits when all is combined with a task', () => {
		mockExit();
		expect(() => selectTasksFromArgs(['all', 'env-vars'], selectableTasks)).toThrow('exit 1');
	});

	it('exits when prerequisite is combined with a task', () => {
		mockExit();
		expect(() => selectTasksFromArgs(['prerequisite', 'env-vars'], selectableTasks)).toThrow(
			'exit 1'
		);
	});

	it('exits for unknown task ids', () => {
		mockExit();
		expect(() => selectTasksFromArgs(['missing'], selectableTasks)).toThrow('exit 1');
	});
});

describe('migration task tally', () => {
	// a `Comments` stub: addMigrationTask only needs `add`
	const comments = { add: () => {} } as unknown as Comments;
	const node = {} as AstTypes.Node;

	afterEach(() => resetMigrationTaskCount());

	it('increments the count each time a migration task is added', () => {
		resetMigrationTaskCount();
		expect(getMigrationTaskCount()).toBe(0);

		addMigrationTask('do this', { comments, node });
		addMigrationTask('do that', { comments, node });

		expect(getMigrationTaskCount()).toBe(2);
	});

	it('resets the count back to zero', () => {
		addMigrationTask('do this', { comments, node });
		resetMigrationTaskCount();
		expect(getMigrationTaskCount()).toBe(0);
	});
});

describe('hasInstallConflict', () => {
	it('detects --install and --no-install used together', () => {
		expect(hasInstallConflict(['sv', 'migrate', '--install', 'pnpm', '--no-install'])).toBe(true);
		expect(hasInstallConflict(['sv', 'migrate', '--install=pnpm', '--no-install'])).toBe(true);
	});

	it('allows either install option by itself', () => {
		expect(hasInstallConflict(['sv', 'migrate', '--install', 'pnpm'])).toBe(false);
		expect(hasInstallConflict(['sv', 'migrate', '--no-install'])).toBe(false);
	});
});
