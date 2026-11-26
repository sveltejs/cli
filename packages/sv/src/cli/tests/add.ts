import process from 'node:process';
import * as p from '@clack/prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAddonDetails } from '../../addons/index.ts';
import { compatibleCommunityAddons } from '../../core/community-addons.ts';
import {
	createLoadedAddon,
	defineAddon,
	defineAddonOptions,
	type Addon,
	type AddonDefinition,
	type SetupResult
} from '../../core/config.ts';
import { createWorkspace } from '../../core/workspace.ts';
import { promptAddonQuestions, resolvePreferredOptions } from '../add.ts';

// ESM namespace exports can't be spied on
vi.mock('@clack/prompts', async (importOriginal) => ({
	...(await importOriginal<typeof import('@clack/prompts')>()),
	select: vi.fn(),
	multiselect: vi.fn(),
	autocompleteMultiselect: vi.fn()
}));

const select = vi.mocked(p.select);
// a fixture, so a stale baked list (e.g. after an sv major bump) can't break these tests
vi.mock('../../core/community-addons.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../core/community-addons.ts')>()),
	compatibleCommunityAddons: vi.fn(() => [
		{ name: 'x', description: 'X', sv: '^1.0.0', downloads: 1 }
	])
}));

const multiselect = vi.mocked(p.multiselect);
const autocomplete = vi.mocked(p.autocompleteMultiselect);
afterEach(() => {
	select.mockReset();
	multiselect.mockReset();
	autocomplete.mockReset();
});

const POSTGRES = { database: 'postgresql', postgresql: 'postgres.js', docker: false } as const;

function dashboardAddon(
	id = 'test-dashboard',
	drizzlePreferred: Record<string, unknown> = POSTGRES
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
		setup: ({ draftOptions, dependsOn }) => {
			if (draftOptions.template !== 'dashboard') return;
			dependsOn('drizzle', drizzlePreferred as never);
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

describe('preferred options', () => {
	it('adds dependencies with preferred options from a CLI-selected template', async () => {
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

	it('runs dependency setup with the preferred options of its parent', async () => {
		const drizzle = getAddonDetails('drizzle');
		const originalSetup = drizzle.setup;
		let seen: unknown;
		drizzle.setup = (workspace) => {
			seen = workspace.draftOptions.database;
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

	it('drops preferred options made stale by a conflicting answer', async () => {
		select.mockResolvedValueOnce('sqlite').mockResolvedValueOnce('libsql');

		const { answers } = await prompt(
			[dashboardAddon('a'), dashboardAddon('b', { database: 'sqlite' })],
			{ a: ['template:dashboard'], b: ['template:dashboard'] }
		);

		expect(answers.drizzle).toEqual({ database: 'sqlite', sqlite: 'libsql' });
	});

	it.each([
		[{ database: 'oracle' }, /Invalid 'drizzle' preferred option from 'test-dashboard'/],
		[{ nope: true }, /Invalid 'drizzle' preferred option from 'test-dashboard'/],
		[{ database: 'sqlite', postgresql: 'neon' }, /Incompatible 'drizzle' option/]
	])('rejects invalid preferred options: %j', async (preferred, error) => {
		await expect(
			prompt([dashboardAddon('test-dashboard', preferred)], {
				'test-dashboard': ['template:dashboard']
			})
		).rejects.toThrow(error);
	});
});

describe('resolvePreferredOptions', () => {
	const drizzle = getAddonDetails('drizzle');
	const parent = (id: string, preferred: Record<string, unknown>) => ({
		id,
		setupResult: {
			dependsOn: ['drizzle'],
			preferredOptions: { drizzle: preferred },
			unsupported: [],
			runsAfter: ['drizzle'],
			additionalOptions: {}
		} satisfies SetupResult
	});

	it('leaves conflicting sibling values unanswered', () => {
		expect(
			resolvePreferredOptions(drizzle, [
				parent('a', { database: 'postgresql', docker: false }),
				parent('b', { database: 'sqlite' })
			])
		).toEqual({ docker: false });
	});

	it('does not revive a value after a conflict', () => {
		expect(
			resolvePreferredOptions(drizzle, [
				parent('a', { database: 'postgresql' }),
				parent('b', { database: 'sqlite' }),
				parent('c', { database: 'postgresql' })
			])
		).toEqual({});
	});
});

describe('add-on picker', () => {
	it('adds [community] as the last option', async () => {
		multiselect.mockResolvedValue([]);
		await prompt([], {});
		const options = multiselect.mock.calls[0][0].options;
		expect(options.at(-1)).toEqual({
			value: 'community',
			label: '[community]',
			hint: 'not reviewed by Svelte maintainers'
		});
	});

	it('hides [community] when no community add-on is compatible', async () => {
		vi.mocked(compatibleCommunityAddons).mockReturnValueOnce([]);
		multiselect.mockResolvedValue([]);
		await prompt([], {});
		const options = multiselect.mock.calls[0][0].options;
		expect(options.some((o) => o.value === 'community')).toBe(false);
	});

	it('continues with official picks when [community] selects nothing', async () => {
		multiselect.mockResolvedValue(['prettier', 'community']);
		autocomplete.mockResolvedValue([]);
		const { loadedAddons } = await prompt([], {});
		expect(ids(loadedAddons)).toEqual(['prettier']);
		expect(autocomplete).toHaveBeenCalledOnce();
	});
});
