import { dedent, defineAddon, log } from '@sveltejs/cli-core';
import { common, exports, imports, object } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'playwright',
	shortDescription: 'browser testing',
	homepage: 'https://playwright.dev',
	options: {},
	run: ({ sv, typescript }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.devDependency('@playwright/test', '^1.49.1');

		sv.file('package.json', (content) => {
			const { data, generateCode } = parseJson(content);
			data.scripts ??= {};
			const scripts: Record<string, string> = data.scripts;
			const TEST_CMD = 'playwright test';
			const RUN_TEST = 'npm run test:e2e';
			scripts['test:e2e'] ??= TEST_CMD;
			scripts['test'] ??= RUN_TEST;
			if (!scripts['test'].includes(RUN_TEST)) scripts['test'] += ` && ${RUN_TEST}`;
			return generateCode();
		});

		sv.file('.gitignore', (content) => {
			if (!content) return content;
			if (content.includes('test-results')) return content;
			return 'test-results\n' + content.trim();
		});

		sv.file(`e2e/demo.test.${ext}`, (content) => {
			if (content) return content;

			return dedent`
				import { expect, test } from '@playwright/test';

				test('home page has expected h1', async ({ page }) => {
					await page.goto('/');
					await expect(page.locator('h1')).toBeVisible();
				});
				`;
		});

		sv.file(`playwright.config.${ext}`, (content) => {
			const { ast, generateCode } = parseScript(content);
			const defineConfig = common.parseExpression('defineConfig({})');
			const { value: defaultExport } = exports.createDefault(ast, { fallback: defineConfig });

			const config = {
				webServer: object.create({
					command: 'npm run build && npm run preview',
					port: 4173
				}),
				testDir: common.createLiteral('e2e')
			};

			if (
				defaultExport.type === 'CallExpression' &&
				defaultExport.arguments[0]?.type === 'ObjectExpression'
			) {
				// uses the `defineConfig` helper
				imports.addNamed(ast, {
					from: '@playwright/test',
					imports: ['defineConfig']
				});
				object.addProperties(defaultExport.arguments[0], { properties: config });
			} else if (defaultExport.type === 'ObjectExpression') {
				// if the config is just an object expression, just add the property
				object.addProperties(defaultExport, { properties: config });
			} else {
				// unexpected config shape
				log.warn('Unexpected playwright config for playwright add-on. Could not update.');
			}
			return generateCode();
		});
	}
});
