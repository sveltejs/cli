import { dedent, defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { array, imports, object, vite } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

const options = defineAddonOptions()
	// .add('plugins', {
	// 	question: 'Which quickpickle plugins would you like to add?',
	// 	type: 'multiselect',
	// 	default: ['e2e'],
	// 	options: [
	//    { value: 'e2e', label: 'behavioral end-to-end tests, with playwright' },
	// 	],
	// 	required: true
	// })
	.build();

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
		// if (componentsSelected) {
		// 	sv.devDependency('@quickpickle/vitest-browser', '^0.2.2');
		// }

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

		// if (componentsSelected) {
		// 	sv.file(`vitest.config.components.${ext}`, (content) => {
		// 		if (content) return content;

		// 		return dedent`
		// 			import { defineProject } from 'vitest/config';
		// 			import { playwright } from '@vitest/browser-playwright';
		// 			import { quickpickle } from 'quickpickle';

		// 			export default defineProject({
		// 				plugins: [quickpickle()],
		// 				test: {
		// 					name: 'components',
		// 					browser: {
		// 						enabled: true,
		// 						provider: playwright(),
		// 						instances: [{ browser: 'chromium', headless: true }]
		// 					},
		// 					include: ['./**/*.svelte.feature'],
		// 					setupFiles: ['./tests/components.steps.${ext}']
		// 				}
		// 			});
		// 		`.replace(/\$\{ext\}/g, ext);
		// 	});

		// 	sv.file(`tests/components.steps.${ext}`, (content) => {
		// 		if (content) return content;

		// 		if (typescript) {
		// 			return dedent`
		// 				import '@quickpickle/vitest-browser/world';
		// 				import '@quickpickle/vitest-browser/actions';
		// 				import '@quickpickle/vitest-browser/outcomes';
		// 				import { Given, When, Then } from 'quickpickle';
		// 				import type { VitestBrowserWorld } from '@quickpickle/vitest-browser';

		// 				Then('the tests should work', async function (world: VitestBrowserWorld) {
		// 					// Add your step implementation here
		// 				});
		// 			`;
		// 		} else {
		// 			return dedent`
		// 				import '@quickpickle/vitest-browser/world';
		// 				import '@quickpickle/vitest-browser/actions';
		// 				import '@quickpickle/vitest-browser/outcomes';
		// 				import { Given, When, Then } from 'quickpickle';

		// 				Then('the tests should work', async function () {
		// 					// Add your step implementation here
		// 				});
		// 			`;
		// 		}
		// 	});

		// 	// Create example component and component test
		// 	const libDirectory = kit?.libDirectory || 'src/lib';
		// 	sv.file(`${libDirectory}/QuickPickleTestWidget.svelte`, (content) => {
		// 		if (content) return content;

		// 		return dedent`
		// 			<script>
		// 				let count = 0;
		// 			</script>

		// 			<div class="widget">
		// 				<h2>QuickPickle Test Widget</h2>
		// 				<p>Count: {count}</p>
		// 				<button on:click={() => count++}>Increment</button>
		// 			</div>

		// 			<style>
		// 				.widget {
		// 					padding: 1rem;
		// 					border: 1px solid #ccc;
		// 					border-radius: 4px;
		// 				}
		// 				h2 {
		// 					margin: 0 0 0.5rem 0;
		// 				}
		// 				button {
		// 					margin-top: 0.5rem;
		// 					padding: 0.5rem 1rem;
		// 				}
		// 			</style>
		// 		`;
		// 	});

		// 	sv.file(`${libDirectory}/QuickPickleTestWidget.svelte.feature`, (content) => {
		// 		if (content) return content;

		// 		return dedent`
		// 			# QuickPickle Test Widget

		// 			As a developer
		// 			I want to test the QuickPickle Test Widget
		// 			So that I can verify component testing works

		// 				Scenario: Widget displays correctly
		// 					Given I render the QuickPickleTestWidget component
		// 					Then I should see "QuickPickle Test Widget"
		// 					And I should see "Count: 0"
		// 					When I click the "Increment" button
		// 					Then I should see "Count: 1"
		// 					And the screnshot should match
		// 					And the tests should work
		// 		`;
		// 	});
		// }

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
			// if (componentsSelected) {
			// 	array.append(workspaceArray, `./vitest.config.components.${ext}`);
			// }

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
