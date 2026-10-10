import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';
import * as p from '@clack/prompts';
import {
	createLoadedAddon,
	defineAddon,
	defineAddonOptions,
	type SetupResult
} from '../../core/config.ts';
import { createWorkspace } from '../../core/workspace.ts';
import { promptAddonQuestions, resolveDependencyOptions } from '../add.ts';

function setupResult(
	dependsOn: string[],
	dependencyOptions: Record<string, Record<string, unknown>> = {}
): SetupResult {
	return {
		dependsOn,
		dependencyOptions,
		unsupported: [],
		runsAfter: dependsOn,
		additionalOptions: {}
	};
}

describe('dependency option defaults', () => {
	it('applies a root add-on’s defaults to automatically added official add-ons', async () => {
		const options = defineAddonOptions<{ template: 'base' | 'dashboard' }>()
			.add('template', {
				question: 'Template',
				type: 'select',
				default: 'base',
				options: [
					{ value: 'base', label: 'Base' },
					{ value: 'dashboard', label: 'Dashboard' }
				]
			})
			.build();
		const dashboard = defineAddon({
			id: 'test-dashboard',
			options,
			setup: ({ options, dependsOn }) => {
				if (options.template === 'dashboard') {
					dependsOn('drizzle', {
						database: 'postgresql',
						postgresql: 'postgres.js',
						docker: false
					});
					dependsOn('better-auth', { demo: [] });
				}
			},
			run: () => {}
		});
		const workspace = await createWorkspace({
			cwd: process.cwd(),
			packageManager: 'npm',
			override: { isKit: true, dependencies: {} }
		});

		const { answers, loadedAddons } = await promptAddonQuestions({
			options: {
				cwd: process.cwd(),
				install: false,
				gitCheck: false,
				downloadCheck: false,
				addons: { 'test-dashboard': ['template:dashboard'] }
			},
			loadedAddons: [createLoadedAddon(dashboard)],
			workspace
		});

		expect(loadedAddons.map(({ addon }) => addon.id)).toEqual([
			'test-dashboard',
			'drizzle',
			'better-auth'
		]);
		expect(answers.drizzle).toMatchObject({
			database: 'postgresql',
			postgresql: 'postgres.js',
			docker: false
		});
		expect(answers['better-auth']).toEqual({ demo: [] });
	});
	it('uses an interactively selected dashboard mode to add dependencies', async () => {
		const options = defineAddonOptions<{ template: 'base' | 'dashboard' }>()
			.add('template', {
				question: 'Template',
				type: 'select',
				default: 'base',
				options: [
					{ value: 'base', label: 'Base' },
					{ value: 'dashboard', label: 'Dashboard' }
				]
			})
			.build();
		const addon = defineAddon({
			id: 'test-interactive-template',
			options,
			setup: ({ options, dependsOn }) => {
				if (options.template === 'dashboard') {
					dependsOn('drizzle', { database: 'postgresql', postgresql: 'postgres.js', docker: false });
					dependsOn('better-auth', { demo: [] });
				}
			},
			run: () => {}
		});
		const workspace = await createWorkspace({
			cwd: process.cwd(),
			packageManager: 'npm',
			override: { isKit: true, dependencies: {} }
		});

		const select = vi.spyOn(p, 'select');
		try {
			for (const template of ['dashboard', 'base'] as const) {
				select.mockResolvedValueOnce(template);
				const { answers, loadedAddons } = await promptAddonQuestions({
					options: {
						cwd: process.cwd(),
						install: false,
						gitCheck: false,
						downloadCheck: false,
						addons: { 'test-interactive-template': [] }
					},
					loadedAddons: [createLoadedAddon(addon)],
					workspace
				});
				expect(answers['test-interactive-template'].template).toBe(template);
				expect(loadedAddons.map(({ addon }) => addon.id)).toEqual(
					template === 'dashboard'
						? ['test-interactive-template', 'drizzle', 'better-auth']
						: ['test-interactive-template']
				);
				if (template === 'dashboard') {
					expect(answers.drizzle).toMatchObject({
						database: 'postgresql',
						postgresql: 'postgres.js',
						docker: false
					});
					expect(answers['better-auth']).toEqual({ demo: [] });
				}
			}
		} finally {
			select.mockRestore();
		}
	});

	it('uses the nearest dependency defaults for implicit add-ons', () => {
		expect(
			resolveDependencyOptions(['dashboard'], {
				dashboard: setupResult(['drizzle'], {
					drizzle: { database: 'postgresql', postgresql: 'postgres.js', docker: false }
				}),
				drizzle: setupResult([])
			})
		).toEqual({ drizzle: { database: 'postgresql', postgresql: 'postgres.js', docker: false } });
	});

	it('leaves conflicting sibling defaults unanswered so the user can choose', () => {
		expect(
			resolveDependencyOptions(['dashboard', 'other'], {
				dashboard: setupResult(['drizzle'], { drizzle: { database: 'postgresql', docker: false } }),
				other: setupResult(['drizzle'], { drizzle: { database: 'sqlite', docker: false } }),
				drizzle: setupResult([])
			})
		).toEqual({ drizzle: { docker: false } });
	});

	it('prefers a root add-on default over a nested dependency default and skips explicit dependencies', () => {
		const setupResults = {
			dashboard: setupResult(['drizzle', 'better-auth'], {
				drizzle: { database: 'postgresql' },
				'better-auth': { demo: [] }
			}),
			'better-auth': setupResult(['drizzle'], { drizzle: { database: 'sqlite' } }),
			drizzle: setupResult([])
		};

		expect(resolveDependencyOptions(['dashboard'], setupResults)).toEqual({
			drizzle: { database: 'postgresql' },
			'better-auth': { demo: [] }
		});
		expect(resolveDependencyOptions(['dashboard', 'drizzle'], setupResults)).toEqual({
			'better-auth': { demo: [] }
		});
	});
});
