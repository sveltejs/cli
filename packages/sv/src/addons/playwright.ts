import { log } from '@clack/prompts';
import { color, dedent, md, transforms } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';
import { addToDemoPage } from './common.ts';

export default defineAddon({
	id: 'playwright',
	shortDescription: 'browser testing',
	homepage: 'https://playwright.dev',
	options: {},
	run: ({ sv, language, file, isKit, directory }) => {
		sv.devDependency('@playwright/test', '^1.58.2');

		sv.file(
			file.package,
			transforms.json(({ data, json }) => {
				json.packageScriptsUpsert(data, 'prepare', 'playwright install', { mode: 'prepend' });
				json.packageScriptsUpsert(data, 'test:e2e', 'playwright test');
				json.packageScriptsUpsert(data, 'test', 'npm run test:e2e');
			})
		);

		sv.file(
			file.gitignore,
			transforms.text(({ content, text }) => {
				if (!content) return false;
				return text.upsert(content, 'test-results', { comment: 'Playwright' });
			})
		);

		const testDir = isKit ? `${directory.kitRoutes}/demo/playwright` : directory.src;
		const testRoute = isKit ? '/demo/playwright' : '/';

		if (isKit) {
			sv.file(`${directory.kitRoutes}/demo/+page.svelte`, addToDemoPage('playwright', language));

			sv.file(
				`${testDir}/+page.svelte`,
				transforms.text(({ content }) => {
					if (content) return false;

					return dedent`
						<h1>Playwright e2e test demo</h1>
					`;
				})
			);
		}

		sv.file(
			`${testDir}/${isKit ? 'page' : 'app'}.svelte.e2e.${language}`,
			transforms.text(({ content }) => {
				if (content) return false;

				return dedent`
					import { expect, test } from '@playwright/test';

					test('has expected h1', async ({ page }) => {
						await page.goto('${testRoute}');
						await expect(page.locator('h1')).toBeVisible();
					});
				`;
			})
		);

		sv.file(
			`playwright.config.${language}`,
			transforms.script(({ ast, js }) => {
				const defineConfig = js.common.parseExpression('defineConfig({})');
				const { value: defaultExport } = js.exports.createDefault(ast, { fallback: defineConfig });

				const config = {
					webServer: {
						command: 'npm run build && npm run preview',
						port: 4173
					},
					testMatch: '**/*.e2e.{ts,js}'
				};

				if (
					defaultExport.type === 'CallExpression' &&
					defaultExport.arguments[0]?.type === 'ObjectExpression'
				) {
					js.imports.addNamed(ast, { imports: ['defineConfig'], from: '@playwright/test' });
					js.object.overrideProperties(defaultExport.arguments[0], config);
				} else if (defaultExport.type === 'ObjectExpression') {
					js.object.overrideProperties(defaultExport, config);
				} else {
					log.warn('Unexpected playwright config for playwright add-on. Could not update.');
				}
			})
		);

		sv.file('README.md', (content) => {
			return md.upsert(content, '## Add-on Setup', [
				'Playwright',
				'- Run `npx playwright install` to download browsers'
			]);
		});
	},

	nextSteps: ({ isKit }) => {
		const steps: string[] = [];

		steps.push(`Run ${color.command('npx playwright install')} to download browsers`);

		if (isKit) {
			steps.push(`Visit ${color.route('/demo/playwright')} to see the demo page`);
		}

		steps.push(`Run ${color.command('npm run test:e2e')} to execute the example tests`);

		return steps;
	}
});
