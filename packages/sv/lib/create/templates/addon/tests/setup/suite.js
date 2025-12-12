import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { add } from 'sv';
import { addPnpmBuildDependencies, createProject, startPreview } from 'sv/testing';
import * as vitest from 'vitest';

const cwd = vitest.inject('testDir');
const templatesDir = vitest.inject('templatesDir');
const variants = vitest.inject('variants');

/**
 * Sets up test infrastructure for addon testing.
 * Creates test projects, configures browser environment, and prepares test cases.
 *
 * @param {object} addons - The addons to test
 * @param {object} [options] - Configuration options for test setup
 * @param {Array<object>} [options.kinds] - Array of addon test case kinds to generate. Each kind has `type` (string) and `options` (Object) properties.
 * @param {Function} [options.filter] - Optional filter function to exclude certain test cases. Receives an object with `variant` (string) and `kind` (Object) properties, returns boolean.
 * @param {boolean} [options.browser=true] - Whether to enable browser testing with Playwright
 * @param {Function} [options.preAdd] - Optional hook called before adding addons to each test case. Receives an object with `addonTestCase` (Object with `variant` and `kind`) and `cwd` (string) properties. May return Promise or void.
 * @returns {object} Object containing: `test` (Function) - The extended Vitest test function with fixtures; `testCases` (Array<object>) - Array of test cases, each with `variant` (string) and `kind` (Object) properties; `prepareServer` (Function) - Function to build and start preview server
 */
export function setupTest(addons, options) {
	/** @type {Function} */
	const test = vitest.test.extend({});

	const withBrowser = options?.browser ?? true;

	/** @type {Function} */
	let create;
	/** @type {import('@playwright/test').Browser} */
	let browser;

	if (withBrowser) {
		vitest.beforeAll(async () => {
			browser = await chromium.launch();
			return async () => {
				await browser.close();
			};
		});
	}

	/** @type {Array<{ variant: string; kind: { type: string; options?: object } }>} */
	const testCases = [];
	for (const kind of options?.kinds ?? []) {
		for (const variant of variants) {
			/** @type {{ variant: string; kind: { type: string; options?: object } }} */
			const addonTestCase =
				/** @type {{ variant: string; kind: { type: string; options?: object } }} */ ({
					variant,
					kind
				});
			if (options?.filter === undefined || options.filter(addonTestCase)) {
				testCases.push(addonTestCase);
			}
		}
	}
	/** @type {string} */
	let testName;
	vitest.beforeAll(async ({ name }) => {
		const testNamePart = path.dirname(name).split('/').at(-1);
		if (!testNamePart) throw new Error('Could not determine test name');
		testName = testNamePart;

		// constructs a builder to create test projects
		create = createProject({ cwd, templatesDir, testName });

		// creates a pnpm workspace in each addon dir
		fs.writeFileSync(
			path.resolve(cwd, testName, 'pnpm-workspace.yaml'),
			"packages:\n  - '**/*'",
			'utf8'
		);

		// creates a barebones package.json in each addon dir
		fs.writeFileSync(
			path.resolve(cwd, testName, 'package.json'),
			JSON.stringify({
				name: `${testName}-workspace-root`,
				private: true
			})
		);

		for (const addonTestCase of testCases) {
			const { variant, kind } = addonTestCase;
			const cwd = create({ testId: `${kind.type}-${variant}`, variant });

			// test metadata
			const metaPath = path.resolve(cwd, 'meta.json');
			fs.writeFileSync(metaPath, JSON.stringify({ variant, kind }, null, '\t'), 'utf8');

			if (options?.preAdd) {
				await options.preAdd({ addonTestCase, cwd });
			}
			const { pnpmBuildDependencies } = await add({
				cwd,
				/** @type {any} */
				addons,
				/** @type {any} */
				options: kind.options || {},
				packageManager: 'pnpm'
			});
			await addPnpmBuildDependencies(cwd, 'pnpm', ['esbuild', ...pnpmBuildDependencies]);
		}

		execSync('pnpm install', { cwd: path.resolve(cwd, testName), stdio: 'pipe' });
	});

	// runs before each test case
	vitest.beforeEach(async (/** @type {any} */ ctx) => {
		/** @type {import('@playwright/test').BrowserContext} */
		let browserCtx;
		if (withBrowser) {
			browserCtx = await browser.newContext();
			/** @type {import('@playwright/test').Page} */
			ctx.page = await browserCtx.newPage();
		}

		/** @type {Function} */
		ctx.cwd = (/** @type {{ variant: string; kind: { type: string } }} */ addonTestCase) => {
			return path.join(cwd, testName, `${addonTestCase.kind.type}-${addonTestCase.variant}`);
		};

		return async () => {
			if (withBrowser) {
				await browserCtx.close();
			}
			// ...other tear downs
		};
	});

	return { test, testCases, prepareServer };
}

/**
 * Installs dependencies, builds the project, and spins up the preview server.
 * Navigates the browser page to the preview URL and handles cleanup on errors.
 *
 * @param {object} options - Configuration options for server preparation
 * @param {string} options.cwd - The current working directory of the project to build and preview
 * @param {import('@playwright/test').Page} options.page - The Playwright page instance to navigate
 * @param {string} [options.buildCommand='pnpm build'] - Command to build the project
 * @param {string} [options.previewCommand='pnpm preview'] - Command to start the preview server
 * @returns {Promise<object>} Object containing: `url` (string) - The preview server URL; `close` (Function) - Async function to close the preview server
 * @throws {Error} Throws an error if navigation to the preview URL fails, after cleaning up the server
 */
async function prepareServer({
	cwd,
	page,
	buildCommand = 'pnpm build',
	previewCommand = 'pnpm preview'
}) {
	// build project
	if (buildCommand) execSync(buildCommand, { cwd, stdio: 'pipe' });

	// start preview server
	const { url, close } = await startPreview({ cwd, command: previewCommand });

	// increases timeout as 30s is not always enough when running the full suite
	page.setDefaultNavigationTimeout(60_000);

	try {
		// navigate to the page
		await page.goto(url);
	} catch (e) {
		// cleanup in the instance of a timeout
		await close();
		throw e;
	}

	return { url, close };
}
