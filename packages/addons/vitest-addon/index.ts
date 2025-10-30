import { dedent, defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { array, imports, object, functions, vite } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

const options = defineAddonOptions()
	.add('usages', {
		question: 'What do you want to use vitest for?',
		type: 'multiselect',
		default: ['unit', 'component'],
		options: [
			{ value: 'unit', label: 'unit testing' },
			{ value: 'component', label: 'component testing' }
		],
		required: true
	})
	.build();

export default defineAddon({
	id: 'vitest',
	shortDescription: 'unit testing',
	homepage: 'https://vitest.dev',
	options,
	run: ({ sv, files, typescript, kit, options }) => {
		const ext = typescript ? 'ts' : 'js';
		const unitTesting = options.usages.includes('unit');
		const componentTesting = options.usages.includes('component');

		sv.devDependency('vitest', '^4.0.5');

		if (componentTesting) {
			sv.devDependency('@vitest/browser-playwright', '^4.0.5');
			sv.devDependency('vitest-browser-svelte', '^2.0.1');
			sv.devDependency('playwright', '^1.56.1');
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
				? `${kit.routesDirectory}/page.svelte.spec.${ext}`
				: `src/App.svelte.test.${ext}`;

			sv.file(fileName, (content) => {
				if (content) return content;

				return dedent`
						import { page } from 'vitest/browser';
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
		}

		sv.file(files.viteConfig, (content) => {
			const { ast, generateCode } = parseScript(content);

			const clientObjectExpression = object.create({
				extends: `./${files.viteConfig}`,
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: functions.createCall({ name: 'playwright', args: [] }),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			});

			const serverObjectExpression = object.create({
				extends: `./${files.viteConfig}`,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			});

			const viteConfig = vite.getConfig(ast);

			const testObject = object.property(viteConfig, {
				name: 'test',
				fallback: object.create({
					expect: {
						requireAssertions: true
					}
				})
			});

			const workspaceArray = object.property(testObject, {
				name: 'projects',
				fallback: array.create()
			});

			if (componentTesting) array.append(workspaceArray, clientObjectExpression);
			if (unitTesting) array.append(workspaceArray, serverObjectExpression);

			// Manage imports
			if (componentTesting)
				imports.addNamed(ast, { imports: ['playwright'], from: '@vitest/browser-playwright' });
			const importName = 'defineConfig';
			const { statement, alias } = imports.find(ast, { name: importName, from: 'vite' });
			if (statement) {
				// Switch the import from 'vite' to 'vitest/config' (keeping the alias)
				imports.addNamed(ast, { imports: { defineConfig: alias }, from: 'vitest/config' });

				// Remove the old import
				imports.remove(ast, { name: importName, from: 'vite', statement });
			}

			return generateCode();
		});
	}
});
