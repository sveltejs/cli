import { dedent, defineAddon, log } from '../../core/index.ts';
import { common, exports, imports, object } from '../../core/tooling/js/index.ts';
import { parseJson, parseScript } from '../../core/tooling/parsers.ts';

export default defineAddon({
	id: 'playwright',
	shortDescription: 'browser testing',
	homepage: 'https://playwright.dev',
	options: {},
	run: ({ sv, typescript, files }) => {
		const ext = typescript ? 'ts' : 'js';

		sv.devDependency('@playwright/test', '^1.57.0');

		sv.file(files.package, (content) => {
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

		sv.file(files.gitignore, (content) => {
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
				webServer: {
					command: 'npm run build && npm run preview',
					port: 4173
				},
				testDir: 'e2e'
			};

			if (
				defaultExport.type === 'CallExpression' &&
				defaultExport.arguments[0]?.type === 'ObjectExpression'
			) {
				// uses the `defineConfig` helper
				imports.addNamed(ast, { imports: ['defineConfig'], from: '@playwright/test' });
				object.overrideProperties(defaultExport.arguments[0], config);
			} else if (defaultExport.type === 'ObjectExpression') {
				// if the config is just an object expression, just add the properties
				object.overrideProperties(defaultExport, config);
			} else {
				// unexpected config shape
				log.warn('Unexpected playwright config for playwright add-on. Could not update.');
			}
			return generateCode();
		});
	}
});
