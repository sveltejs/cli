import { dedent, defineAddon, defineAddonOptions, log } from '@sveltejs/cli-core';
import { array, exports, functions, object } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

const options = defineAddonOptions({
	usages: {
		question: 'What do you want to use vitest for?',
		type: 'multiselect',
		default: ['unit', 'component'],
		options: [
			{ value: 'unit', label: 'unit testing' },
			{ value: 'component', label: 'component testing' }
		],
		required: true
	}
});

export default defineAddon({
	id: 'vitest',
	shortDescription: 'unit testing',
	homepage: 'https://vitest.dev',
	options,
	run: ({ sv, typescript, kit, options }) => {
		const ext = typescript ? 'ts' : 'js';
		const unitTesting = options.usages.includes('unit');
		const componentTesting = options.usages.includes('component');

		sv.devDependency('vitest', '^3.2.3');

		if (componentTesting) {
			sv.devDependency('@vitest/browser', '^3.2.3');
			sv.devDependency('vitest-browser-svelte', '^0.1.0');
			sv.devDependency('playwright', '^1.53.0');
		}

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

		if (unitTesting) {
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
		}

		if (componentTesting) {
			const fileName = kit
				? `${kit.routesDirectory}/page.svelte.test.${ext}`
				: `src/App.svelte.test.${ext}`;

			sv.file(fileName, (content) => {
				if (content) return content;

				return dedent`
						import { page } from '@vitest/browser/context';
						import { describe, expect, it } from 'vitest';
						import { render } from 'vitest-browser-svelte';
						${kit ? "import Page from './+page.svelte';" : "import App from './App.svelte';"}

						describe('${kit ? '/+page.svelte' : 'App.svelte'}', () => {
							it('should render h1', async () => {
								render(${kit ? 'Page' : 'App'});
								
								const heading = page.getByRole('heading', { level: 1 });
								await expect.element(heading).toBeInTheDocument();
							});
						});
					`;
			});

			sv.file(`vitest-setup-client.${ext}`, (content) => {
				if (content) return content;

				return dedent`
					/// <reference types="@vitest/browser/matchers" />
					/// <reference types="@vitest/browser/providers/playwright" />
				`;
			});
		}

		sv.file(`vite.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);

			const clientObjectExpression = object.createFromPrimitives({
				extends: `./vite.config.${ext}`,
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: [`./vitest-setup-client.${ext}`]
				}
			});

			const serverObjectExpression = object.createFromPrimitives({
				extends: `./vite.config.${ext}`,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			});

			const defineConfigFallback = functions.call('defineConfig', []);
			const { value: defineWorkspaceCall } = exports.defaultExport(ast, defineConfigFallback);
			if (defineWorkspaceCall.type !== 'CallExpression') {
				log.warn('Unexpected vite config. Could not update.');
			}

			const vitestConfig = functions.argumentByIndex(defineWorkspaceCall, 0, object.createEmpty());
			const testObject = object.property(vitestConfig, 'test', object.createEmpty());

			const workspaceArray = object.property(testObject, 'projects', array.createEmpty());

			if (componentTesting) array.push(workspaceArray, clientObjectExpression);
			if (unitTesting) array.push(workspaceArray, serverObjectExpression);

			return generateCode();
		});
	}
});
