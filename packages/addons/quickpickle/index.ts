import { dedent, defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { array, imports, object, vite } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

const options = defineAddonOptions().build();

export default defineAddon({
	id: 'quickpickle',
	shortDescription: 'behavioral testing using Cucumber in Vitest',
	homepage: 'https://github.com/dnotes/quickpickle',
	options,
	run: ({ sv, files, typescript, kit }) => {
		const ext = typescript ? 'ts' : 'js';
		const componentsSelected = false;

		// Install dependencies
		sv.devDependency('quickpickle', '^1.11.0');
		sv.devDependency('@quickpickle/playwright', '^1.2.0');
		sv.devDependency('vitest', '^4.0.10');
		sv.devDependency('playwright', '^1.56.0');

		// Add test scripts
		sv.file(files.package, (content) => {
			const { data, generateCode } = parseJson(content);
			data.scripts ??= {};
			const scripts = data.scripts;

			scripts['test'] ??= 'vitest';
			scripts['test:e2e'] ??= 'vitest --project e2e';
			if (componentsSelected) {
				scripts['test:components'] ??= 'vitest --project components';
			}

			return generateCode();
		});

		// Create workspace config files
		sv.file(`vitest.config.e2e.${ext}`, (content) => {
			if (content) return content;

			return dedent`
					import { defineProject } from 'vitest/config';
					import { quickpickle } from 'quickpickle';

					export default defineProject({
						plugins: [
							quickpickle({
								explodeTags: [
									['nojs', 'js'],
									['dark','light'],
									['chromium', 'firefox', 'webkit'],
									['mobile', 'tablet', 'desktop', 'widescreen']
								],
								worldConfig: {
									port: 5173,
									screenshotOptions: {
										mask: ['img'],
										maskColor: 'violet'
									}
								}
							})
						],
						test: {
							name: 'e2e',
							include: ['./tests/**/*.feature'],
							setupFiles: ['./tests/e2e.steps.${ext}']
						}
					});
				`.replace(/\$\{ext\}/g, ext);
		});

		sv.file(`tests/e2e.steps.${ext}`, (content) => {
			if (content) return content;

			if (typescript) {
				return dedent`
						import '@quickpickle/playwright/world';
						import '@quickpickle/playwright/actions';
						import '@quickpickle/playwright/outcomes';
						import { Given, When, Then } from 'quickpickle';
						import type { PlaywrightWorld } from '@quickpickle/playwright';

						Then('the tests should work', async function (world: PlaywrightWorld) {
							// Add your step implementation here
						});
					`;
			} else {
				return dedent`
						import '@quickpickle/playwright/world';
						import '@quickpickle/playwright/actions';
						import '@quickpickle/playwright/outcomes';
						import { Given, When, Then } from 'quickpickle';

						Then('the tests should work', async function () {
							// Add your step implementation here
						});
					`;
			}
		});

		// Create example feature file for e2e testing
		// Note: Vite + Svelte doesn't support @nojs,
		// and SvelteKit minimal does not pass Axe tests.
		sv.file('tests/front.feature', (content) => {
			if (content) return content;

			return dedent`
					Feature: Front page
						As a user
						I want to see the front page
						So that I can verify the application works

						@js${kit && ' @nojs'}
						Scenario: Viewing the front page
							Given I visit "/"
							Then I should see a "Svelte" heading
							And the tests should work

						@dark @light @todo
						Scenario: Front page accessibility
							Given I visit "/"
							Then all accessibility tests should pass
				`;
		});

		// Add VS Code settings for Cucumber autocomplete
		sv.file(files.vscodeSettings, (content) => {
			const { data, generateCode } = parseJson(content);
			data['cucumber.glue'] = ['**/*.steps.{ts,js,mjs}'];
			data['cucumberautocomplete.steps'] = [
				'**/*.steps.{ts,js,mjs}',
				'**/node_modules/@quickpickle/playwright/**/*.steps.mjs'
			];
			return generateCode();
		});

		// Update main vite config to reference workspace files
		sv.file(files.viteConfig, (content) => {
			const { ast, generateCode } = parseScript(content);

			const viteConfig = vite.getConfig(ast);

			const testObject = object.property(viteConfig, {
				name: 'test',
				fallback: object.create({
					expect: {
						requireAssertions: true
					}
				})
			});

			// Add forceRerunTriggers to the test config
			const forceRerunTriggersArray = object.property(testObject, {
				name: 'forceRerunTriggers',
				fallback: array.create()
			});
			array.append(forceRerunTriggersArray, '**/src/**');

			const workspaceArray = object.property(testObject, {
				name: 'projects',
				fallback: array.create()
			});

			// Add workspace file references
			array.append(workspaceArray, `./vitest.config.e2e.${ext}`);

			// Switch defineConfig import from 'vite' to 'vitest/config'
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
