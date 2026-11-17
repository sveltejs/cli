import process from 'node:process';
import * as p from '@clack/prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAddonDetails } from '../../addons/index.ts';
import {
	createLoadedAddon,
	defineAddon,
	defineAddonOptions,
	type Addon,
	type AddonDefinition,
	type SetupResult
} from '../../core/config.ts';
import { createWorkspace } from '../../core/workspace.ts';
import { promptAddonQuestions, resolveDependencyDefaults } from '../add.ts';

// ESM namespace exports can't be spied on
vi.mock('@clack/prompts', async (importOriginal) => ({
	...(await importOriginal<typeof import('@clack/prompts')>()),
	select: vi.fn()
}));

const select = vi.mocked(p.select);
afterEach(() => select.mockReset());

const POSTGRES = { database: 'postgresql', postgresql: 'postgres.js', docker: false } as const;

function dashboardAddon(
	id = 'test-dashboard',
	drizzleDefaults: Record<string, unknown> = POSTGRES
) {
	return defineAddon({
		id,
		options: defineAddonOptions<{ template: 'base' | 'dashboard' }>()
			.add('template', {
				question: 'Template',
				type: 'select',
				default: 'base',
				options: [
					{ value: 'base', label: 'Base' },
					{ value: 'dashboard', label: 'Dashboard' }
				]
			})
			.build(),
		setup: ({ options, dependsOn }) => {
			if (options.template !== 'dashboard') return;
			dependsOn('drizzle', drizzleDefaults as never);
			dependsOn('better-auth', { demo: [] });
		},
		run: () => {}
	});
}

async function prompt(addons: Array<Addon<any, any>>, cliOptions: Record<string, string[]>) {
	const workspace = await createWorkspace({
		cwd: process.cwd(),
		packageManager: 'npm',
		override: { isKit: true, dependencies: {} }
	});
	return promptAddonQuestions({
		options: {
			cwd: process.cwd(),
			install: false,
			gitCheck: false,
			downloadCheck: false,
			addons: cliOptions
		},
		loadedAddons: addons.map((addon) => createLoadedAddon(addon)),
		workspace
	});
}

const ids = (loaded: Array<{ addon: AddonDefinition }>) => loaded.map(({ addon }) => addon.id);

describe('dependency defaults', () => {
	it('adds dependencies with defaults from a CLI-selected template', async () => {
		const { answers, loadedAddons } = await prompt([dashboardAddon()], {
			'test-dashboard': ['template:dashboard']
		});

		expect(ids(loadedAddons)).toEqual(['test-dashboard', 'drizzle', 'better-auth']);
		expect(answers.drizzle).toEqual(POSTGRES);
		expect(answers['better-auth']).toEqual({ demo: [] });
	});

	it.each([
		['dashboard', ['test-dashboard', 'drizzle', 'better-auth']],
		['base', ['test-dashboard']]
	] as const)('asks the template before setup: %s', async (template, expected) => {
		select.mockResolvedValueOnce(template);

		const { answers, loadedAddons } = await prompt([dashboardAddon()], { 'test-dashboard': [] });

		expect(answers['test-dashboard'].template).toBe(template);
		expect(ids(loadedAddons)).toEqual(expected);
	});

	it('runs dependency setup with the defaults of its parent', async () => {
		const drizzle = getAddonDetails('drizzle');
		const originalSetup = drizzle.setup;
		let seen: unknown;
		drizzle.setup = (workspace) => {
			seen = workspace.options.database;
			return originalSetup?.(workspace);
		};
		try {
			await prompt([dashboardAddon()], { 'test-dashboard': ['template:dashboard'] });
		} finally {
			drizzle.setup = originalSetup;
		}

		expect(seen).toBe('postgresql');
	});

	it('keeps CLI options of an explicitly selected dependency', async () => {
		const { answers } = await prompt([dashboardAddon(), getAddonDetails('drizzle')], {
			'test-dashboard': ['template:dashboard'],
			drizzle: ['database:sqlite', 'sqlite:libsql']
		});

		expect(answers.drizzle).toEqual({ database: 'sqlite', sqlite: 'libsql' });
	});

	it('drops defaults made stale by a conflicting answer', async () => {
		select.mockResolvedValueOnce('sqlite').mockResolvedValueOnce('libsql');

		const { answers } = await prompt(
			[dashboardAddon('a'), dashboardAddon('b', { database: 'sqlite' })],
			{ a: ['template:dashboard'], b: ['template:dashboard'] }
		);

		expect(answers.drizzle).toEqual({ database: 'sqlite', sqlite: 'libsql' });
	});

	it.each([
		[{ database: 'oracle' }, /Invalid 'drizzle' default from 'test-dashboard'/],
		[{ nope: true }, /Invalid 'drizzle' default from 'test-dashboard'/],
		[{ database: 'sqlite', postgresql: 'neon' }, /Incompatible 'drizzle' option/]
	])('rejects invalid defaults: %j', async (defaults, error) => {
		await expect(
			prompt([dashboardAddon('test-dashboard', defaults)], {
				'test-dashboard': ['template:dashboard']
			})
		).rejects.toThrow(error);
	});
});

describe('resolveDependencyDefaults', () => {
	const drizzle = getAddonDetails('drizzle');
	const parent = (id: string, defaults: Record<string, unknown>) => ({
		id,
		setupResult: {
			dependsOn: ['drizzle'],
			dependencyDefaults: { drizzle: defaults },
			unsupported: [],
			runsAfter: ['drizzle'],
			additionalOptions: {}
		} satisfies SetupResult
	});

	it('leaves conflicting sibling values unanswered', () => {
		expect(
			resolveDependencyDefaults(drizzle, [
				parent('a', { database: 'postgresql', docker: false }),
				parent('b', { database: 'sqlite' })
			])
		).toEqual({ docker: false });
	});

	it('does not revive a value after a conflict', () => {
		expect(
			resolveDependencyDefaults(drizzle, [
				parent('a', { database: 'postgresql' }),
				parent('b', { database: 'sqlite' }),
				parent('c', { database: 'postgresql' })
			])
		).toEqual({});
	});
});
