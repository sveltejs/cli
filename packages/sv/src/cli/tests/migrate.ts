import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskWithOptions } from '../../migrate/index.ts';
import { hasInstallConflict, selectOptionalTasksFromArgs } from '../migrate.ts';

const optionalTasks: TaskWithOptions[] = [
	{
		id: 'svelte-config',
		description: 'migrate svelte.config.js',
		required: false,
		run: () => {}
	},
	{
		id: 'env-vars',
		description: 'migrate environment variables',
		required: false,
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

describe('selectTasks', () => {
	it('selects all optional tasks', () => {
		expect(selectOptionalTasksFromArgs(['all'], optionalTasks)).toEqual(optionalTasks);
	});

	it('selects only required tasks', () => {
		expect(selectOptionalTasksFromArgs(['required'], optionalTasks)).toEqual([]);
	});

	it('selects specific optional tasks', () => {
		expect(selectOptionalTasksFromArgs(['env-vars'], optionalTasks)).toEqual([optionalTasks[1]]);
	});

	it('exits when all is combined with a task', () => {
		mockExit();
		expect(() => selectOptionalTasksFromArgs(['all', 'env-vars'], optionalTasks)).toThrow('exit 1');
	});

	it('exits when required is combined with a task', () => {
		mockExit();
		expect(() => selectOptionalTasksFromArgs(['required', 'env-vars'], optionalTasks)).toThrow(
			'exit 1'
		);
	});

	it('exits for unknown task ids', () => {
		mockExit();
		expect(() => selectOptionalTasksFromArgs(['missing'], optionalTasks)).toThrow('exit 1');
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
