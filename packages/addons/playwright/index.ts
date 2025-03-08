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
			const RUN_TEST = 'npm run test:e2e';
			scripts['test:setup'] ??= 'playwright install';
			scripts['test:e2e'] ??= 'playwright test';
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
			const defineConfig = common.expressionFromString('defineConfig({})');
			const defaultExport = exports.defaultExport(ast, defineConfig);

			const config = {
				webServer: object.create({
					command: common.createLiteral('npm run build && npm run preview'),
					port: common.expressionFromString('4173')
				}),
				testDir: common.createLiteral('e2e')
			};

			if (
				defaultExport.value.type === 'CallExpression' &&
				defaultExport.value.arguments[0]?.type === 'ObjectExpression'
			) {
				// uses the `defineConfig` helper
				imports.addNamed(ast, '@playwright/test', { defineConfig: 'defineConfig' });
				object.properties(defaultExport.value.arguments[0], config);
			} else if (defaultExport.value.type === 'ObjectExpression') {
				// if the config is just an object expression, just add the property
				object.properties(defaultExport.value, config);
			} else {
				// unexpected config shape
				log.warn('Unexpected playwright config for playwright add-on. Could not update.');
			}
			return generateCode();
		});
	},
	nextSteps: ({ highlighter, packageManager }) => {
		const steps = [
			`Run ${highlighter.command(`${packageManager} run test:setup`)} to install the browsers`
		];

		return steps;
	}
});
