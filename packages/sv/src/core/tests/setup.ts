import { describe, expect, it } from 'vitest';
import { createLoadedAddon } from '../../cli/add.ts';
import {
	defineAddon,
	defineAddonOptions,
	type Addon,
	type AddonDefinition,
	type LoadedAddon
} from '../config.ts';
import { setupAddons } from '../engine.ts';
import type { Workspace } from '../workspace.ts';

const workspace: Workspace = {
	cwd: '/test/project',
	dependencyVersion: () => undefined,
	language: 'ts',
	file: {
		viteConfig: 'vite.config.ts',
		svelteConfig: 'svelte.config.ts',
		typeConfig: 'tsconfig.json',
		stylesheet: 'src/app.css',
		package: 'package.json',
		gitignore: '.gitignore',
		prettierignore: '.prettierignore',
		prettierrc: '.prettierrc',
		eslintConfig: 'eslint.config.js',
		vscodeSettings: '.vscode/settings.json',
		vscodeExtensions: '.vscode/extensions.json',
		getRelative: () => '',
		findUp: () => ''
	},
	isKit: false,
	directory: { src: 'src', lib: 'src/lib', kitRoutes: 'src/routes' },
	packageManager: 'npm'
};

function toLoaded(addon: Addon<any>): LoadedAddon {
	return createLoadedAddon(addon as AddonDefinition);
}

describe('setupAddons', () => {
	it('should return setup results with empty additionalOptions', async () => {
		const addon: AddonDefinition = {
			id: 'test-addon',
			options: {},
			setup: () => { },
			run: () => { }
		};

		const results = await setupAddons([toLoaded(addon)], workspace);

		expect(results['test-addon']).toBeDefined();
		expect(results['test-addon'].additionalOptions).toEqual({});
		expect(results['test-addon'].dependsOn).toEqual([]);
		expect(results['test-addon'].unsupported).toEqual([]);
		expect(results['test-addon'].runsAfter).toEqual([]);
	});

	it('should collect dynamic options via addOption', async () => {
		const addon: AddonDefinition = {
			id: 'dynamic-addon',
			options: {},
			setup: ({ addOption }) => {
				addOption('org', {
					question: 'Which org?',
					type: 'string',
					default: 'my-org'
				});
			},
			run: () => { }
		};

		const results = await setupAddons([toLoaded(addon)], workspace);

		expect(results['dynamic-addon'].additionalOptions).toEqual({
			org: { question: 'Which org?', type: 'string', default: 'my-org' }
		});
	});

	it('should preserve strong typing with defineAddon and defineAddonOptions', async () => {
		const options = defineAddonOptions()
			.add('plugins', {
				type: 'string',
				question: 'Which Tailwind plugins do you want to use?',
				default: 'hello'
			})
			.build();

		const addon = defineAddon<{ extra: boolean }>()({
			id: 'typed-addon',
			options,
			setup: ({ addOption }) => {
				addOption('extra', {
					question: 'Extra?',
					type: 'boolean',
					default: false
				});
			},
			run: ({ options }) => {
				// strong typing: these would fail at compile time
				// if options.plugins wasn't string or options.extra wasn't boolean
				expect<string>(options.plugins).toBeDefined();
				expect<boolean>(options.extra).toBeDefined();
			}
		});

		const results = await setupAddons([toLoaded(addon)], workspace);

		// static options are strongly typed
		expect(addon.options.plugins.default).toBe('hello');

		// dynamic options from defineAddon<{ extra: boolean }>() are also strongly typed
		expect(addon.options.extra.default).toBe(false);

		// dynamic options are available via setup result too
		expect(results['typed-addon'].additionalOptions).toHaveProperty('extra');
	});

	it('should await async setup', async () => {
		const addon: AddonDefinition = {
			id: 'async-addon',
			options: {},
			setup: async ({ addOption }) => {
				await Promise.resolve();
				addOption('fetched', {
					question: 'Fetched option?',
					type: 'boolean',
					default: true
				});
			},
			run: () => { }
		};

		const results = await setupAddons([toLoaded(addon)], workspace);

		expect(results['async-addon'].additionalOptions).toHaveProperty('fetched');
		expect(addon.options).toHaveProperty('fetched');
	});

	it('should collect multiple dynamic options', async () => {
		const addon: AddonDefinition = {
			id: 'multi-addon',
			options: {},
			setup: ({ addOption }) => {
				addOption('org', {
					question: 'Which org?',
					type: 'string',
					default: ''
				});
				addOption('theme', {
					question: 'Pick theme',
					type: 'select',
					default: 'dark',
					options: [
						{ value: 'dark', label: 'Dark' },
						{ value: 'light', label: 'Light' }
					]
				});
			},
			run: () => { }
		};

		const results = await setupAddons([toLoaded(addon)], workspace);

		expect(Object.keys(results['multi-addon'].additionalOptions)).toEqual(['org', 'theme']);
		expect(Object.keys(addon.options)).toEqual(['org', 'theme']);
	});
});
