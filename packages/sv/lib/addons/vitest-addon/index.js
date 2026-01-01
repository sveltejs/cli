import { dedent, defineAddon, defineAddonOptions, js, parse, color } from '../../core.ts';

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

// Manage only version before current
let vitestV3Installed = false;

export default defineAddon({
	id: 'vitest',
	shortDescription: 'unit testing',
	homepage: 'https://vitest.dev',
	options,

	run: ({ sv, files, typescript, kit, options, dependencyVersion }) => {
		const ext = typescript ? 'ts' : 'js';
		const unitTesting = options.usages.includes('unit');
		const componentTesting = options.usages.includes('component');

		vitestV3Installed = (dependencyVersion('vitest') ?? '')
			.replaceAll('^', '')
			.replaceAll('~', '')
			?.startsWith('3.');

		sv.devDependency('vitest', '^4.0.15');

		if (componentTesting) {
			sv.devDependency('@vitest/browser-playwright', '^4.0.15');
			sv.devDependency('vitest-browser-svelte', '^2.0.1');
			sv.devDependency('playwright', '^1.57.0');
		}

		sv.file(files.package, (content) => {
			const { data, generateCode } = parse.json(content);
			data.scripts ??= {};
			/** @type {Record<string, string>} */
			const scripts = data.scripts;
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
			const { ast, generateCode } = parse.script(content);

			const clientObjectExpression = js.object.create({
				extends: `./${files.viteConfig}`,
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: js.functions.createCall({ name: 'playwright', args: [] }),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			});

			const serverObjectExpression = js.object.create({
				extends: `./${files.viteConfig}`,
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			});

			const viteConfig = js.vite.getConfig(ast);

			const testObject = js.object.property(viteConfig, {
				name: 'test',
				fallback: js.object.create({
					expect: {
						requireAssertions: true
					}
				})
			});

			const workspaceArray = js.object.property(testObject, {
				name: 'projects',
				fallback: js.array.create()
			});

			if (componentTesting) js.array.append(workspaceArray, clientObjectExpression);
			if (unitTesting) js.array.append(workspaceArray, serverObjectExpression);

			// Manage imports
			if (componentTesting)
				js.imports.addNamed(ast, { imports: ['playwright'], from: '@vitest/browser-playwright' });
			const importName = 'defineConfig';
			const { statement, alias } = js.imports.find(ast, { name: importName, from: 'vite' });
			if (statement) {
				// Switch the import from 'vite' to 'vitest/config' (keeping the alias)
				js.imports.addNamed(ast, { imports: { defineConfig: alias }, from: 'vitest/config' });

				// Remove the old import
				js.imports.remove(ast, { name: importName, from: 'vite', statement });
			}

			return generateCode();
		});
	},

	nextSteps: ({ typescript, options }) => {
		/** @type {string[]} */
		const toReturn = [];

		if (vitestV3Installed) {
			const componentTesting = options.usages.includes('component');
			if (componentTesting) {
				toReturn.push(`Uninstall ${color.command('@vitest/browser')} package`);
				toReturn.push(
					`Update usage from ${color.command("'@vitest/browser...'")} to ${color.command("'vitest/browser'")}`
				);
			}
			toReturn.push(
				`${color.optional('Optional')} Check ${color.path('./vite.config.ts')} and remove duplicate project definitions`
			);
			toReturn.push(
				`${color.optional('Optional')} Remove ${color.path('./vitest-setup-client' + (typescript ? '.ts' : '.js'))} file`
			);
		}

		return toReturn;
	}
});
