import { dedent, defineAddon, log } from '@sveltejs/cli-core';
import { array, common, exports, functions, imports, object } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'vitest',
	shortDescription: 'unit testing',
	homepage: 'https://vitest.dev',
	options: {},
	run: ({ sv, typescript, kit }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.devDependency('vitest', '^3.0.0');
		sv.devDependency('@testing-library/svelte', '^5.2.4');
		sv.devDependency('@testing-library/jest-dom', '^6.6.3');
		sv.devDependency('jsdom', '^25.0.1');

		sv.file('package.json', (content) => {
			const { data, generateCode } = parseJson(content);
			data.scripts ??= {};
			const scripts: Record<string, string> = data.scripts;
			const TEST_CMD = 'vitest';
			// we use `--run` so that vitest doesn't run in watch mode when running `npm run test`
			const RUN_TEST = 'npm run test:unit -- --run';
			scripts['test:unit'] ??= TEST_CMD;
			scripts['test'] ??= RUN_TEST;
			if (!scripts['test'].includes(RUN_TEST)) scripts['test'] += ` && ${RUN_TEST}`;
			return generateCode();
		});

		sv.file(`src/demo.spec.${ext}`, (content) => {
			if (content) return content;

			return dedent`
				import { describe, it, expect } from 'vitest';

				describe('sum test', () => {
					it('adds 1 + 2 to equal 3', () => {
						expect(1 + 2).toBe(3);
					});
				});
			`;
		});

		if (kit) {
			sv.file(`${kit.routesDirectory}/page.svelte.test.${ext}`, (content) => {
				if (content) return content;

				return dedent`
						import { describe, test, expect } from 'vitest';
						import '@testing-library/jest-dom/vitest';
						import { render, screen } from '@testing-library/svelte';
						import Page from './+page.svelte';
	
						describe('/+page.svelte', () => {
							test('should render h1', () => {
								render(Page);
								expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
							});
						});
					`;
			});
		} else {
			sv.file(`src/App.svelte.test.${ext}`, (content) => {
				if (content) return content;

				return dedent`
						import { describe, test, expect } from 'vitest';
						import '@testing-library/jest-dom/vitest';
						import { render, screen } from '@testing-library/svelte';
						import App from './App.svelte';
	
						describe('App.svelte', () => {
							test('should render h1', () => {
								render(App);
								expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
							});
						});
					`;
			});
		}

		sv.file(`vitest-setup-client.${ext}`, (content) => {
			if (content) return content;

			return dedent`
					import '@testing-library/jest-dom/vitest';
					import { vi } from 'vitest';

					// add global mocks here, i.e. for sveltekit '$app/state'

					// needed for svelte/motion that exports new MediaQuery which calls window.matchMedia eagerly
					Object.defineProperty(window, "matchMedia", {
						writable: true,
						enumerable: true,
						value: vi.fn().mockImplementation((query) => ({
							matches: false,
							media: query,
							onchange: null,
							addListener: vi.fn(), // deprecated
							removeListener: vi.fn(), // deprecated
							addEventListener: vi.fn(),
							removeEventListener: vi.fn(),
							dispatchEvent: vi.fn(),
						})),
					});
				`;
		});

		sv.file(`vitest.workspace.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			imports.addNamed(ast, 'vitest/config', { defineWorkspace: 'defineWorkspace' });
			imports.addNamed(ast, '@testing-library/svelte/vite', { svelteTesting: 'svelteTesting' });

			const clientObjectExpression = object.create({
				extends: common.createLiteral(`./vite.config.${ext}`),
				plugins: common.expressionFromString('[svelteTesting()]'),
				test: object.create({
					name: common.createLiteral('client'),
					environment: common.createLiteral('jsdom'),
					clearMocks: common.expressionFromString('true'),
					include: common.expressionFromString("['src/**/*.svelte.{test,spec}.{js,ts}']"),
					exclude: common.expressionFromString("['src/lib/server/**']"),
					setupFiles: common.expressionFromString(`['./vitest-setup-client.${ext}']`)
				})
			});
			const serverObjectExpression = object.create({
				extends: common.createLiteral(`./vite.config.${ext}`),
				test: object.create({
					name: common.createLiteral('server'),
					environment: common.createLiteral('node'),
					include: common.expressionFromString("['src/**/*.{test,spec}.{js,ts}']"),
					exclude: common.expressionFromString("['src/**/*.svelte.{test,spec}.{js,ts}']")
				})
			});

			const defineWorkspaceFallback = functions.call('defineWorkspace', []);
			const { value: defineWorkspaceCall } = exports.defaultExport(ast, defineWorkspaceFallback);
			if (defineWorkspaceCall.type !== 'CallExpression') {
				log.warn('Unexpected vite config for vitest add-on. Could not update.');
			}

			const workspaceArray = functions.argumentByIndex(defineWorkspaceCall, 0, array.createEmpty());
			array.push(workspaceArray, clientObjectExpression);
			array.push(workspaceArray, serverObjectExpression);

			return generateCode();
		});
	}
});
