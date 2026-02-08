import { log } from '@clack/prompts';
import { dedent, js, parse, json, text } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';

export default defineAddon({
	id: 'playwright',
	shortDescription: 'browser testing',
	homepage: 'https://playwright.dev',
	options: {},
	run: ({ sv, language, files }) => {
		sv.devDependency('@playwright/test', '^1.58.2');

		sv.file(files.package, (content) => {
			const { data, generateCode } = parse.json(content);

			json.packageScriptsUpsert(data, 'test:e2e', 'playwright test');
			json.packageScriptsUpsert(data, 'test', 'npm run test:e2e');

			return generateCode();
		});

		sv.file(files.gitignore, (content) => {
			if (!content) return content;
			return text.upsert(content, 'test-results', { comment: 'Playwright' });
		});

		sv.file(`e2e/demo.test.${language}`, (content) => {
			if (content) return content;

			return dedent`
				import { expect, test } from '@playwright/test';

				test('home page has expected h1', async ({ page }) => {
					await page.goto('/');
					await expect(page.locator('h1')).toBeVisible();
				});
				`;
		});

		sv.file(`playwright.config.${language}`, (content) => {
			const { ast, generateCode } = parse.script(content);
			const defineConfig = js.common.parseExpression('defineConfig({})');
			const { value: defaultExport } = js.exports.createDefault(ast, { fallback: defineConfig });

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
				js.imports.addNamed(ast, { imports: ['defineConfig'], from: '@playwright/test' });
				js.object.overrideProperties(defaultExport.arguments[0], config);
			} else if (defaultExport.type === 'ObjectExpression') {
				// if the config is just an object expression, just add the properties
				js.object.overrideProperties(defaultExport, config);
			} else {
				// unexpected config shape
				log.warn('Unexpected playwright config for playwright add-on. Could not update.');
			}
			return generateCode();
		});
	}
});
